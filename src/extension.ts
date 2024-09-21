import * as vscode from 'vscode';
import { PicGo } from 'picgo';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';

/** 用于输出日志的通道 */
let outputChannel: vscode.OutputChannel;

/**
 * 解码文件路径
 * @param {string} filePath - 编码后的文件路径
 * @returns {string} 解码后的文件路径
 */
function decodeFilePath(filePath: string): string {
  return decodeURIComponent(filePath).replace(/\\/g, '/');
}

/**
 * 激活扩展
 * @param {vscode.ExtensionContext} context - 扩展上下文
 */
export function activate(context: vscode.ExtensionContext) {
  // 创建输出通道
  outputChannel = vscode.window.createOutputChannel("VS-MDAllInPicGo");

  // 注册上传图片命令
  let uploadImagesCommand = vscode.commands.registerCommand('vs-mdallinpicgo.uploadImages', async () => {
    try {
      // 获取当前活动的文本编辑器
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showErrorMessage('没有打开的编辑器');
        return;
      }

      // 检查当前文档是否为 Markdown 文件
      const document = editor.document;
      if (document.languageId !== 'markdown') {
        vscode.window.showErrorMessage('当前文件不是 Markdown 文件');
        return;
      }

      // 创建 PicGo 实例
      const picgo = new PicGo();
      // PicGo 将自动加载其默认配置文件

      // 执行上传和替换操作
      await uploadAndReplaceImages(editor, document, picgo);
    } catch (error) {
      console.error('命令执行失败:', error);
      let errorMessage = '执行上传图片命令时发生错误';
      if (error instanceof Error) {
        errorMessage += `\n${error.message}`;
      }
      outputChannel.appendLine(errorMessage);
      outputChannel.show(true);
      vscode.window.showErrorMessage("上传图片失败，请查看输出面板了解详情。");
    }
  });

  // 将命令添加到订阅列表中
  context.subscriptions.push(uploadImagesCommand);
}

/**
 * 上传并替换 Markdown 文件中的本地图片
 * @param {vscode.TextEditor} editor - VS Code 文本编辑器
 * @param {vscode.TextDocument} document - 当前文档
 * @param {PicGo} picgo - PicGo 实例
 */
async function uploadAndReplaceImages(editor: vscode.TextEditor, document: vscode.TextDocument, picgo: PicGo) {
  const text: string = document.getText();
  const imageRegex: RegExp = /!\[.*?\]\((.*?)\)/g;
  let match: RegExpExecArray | null;

  let replacements: { range: vscode.Range; newText: string }[] = [];
  let uploadedCount = 0;
  let failedCount = 0;

  const config = vscode.workspace.getConfiguration('vs-mdallinpicgo');
  const uploadInterval = config.get('uploadInterval', 2000);
  const maxRetries = config.get('maxRetries', 3);

  const imagesToUpload = text.match(imageRegex)?.filter(m => !m.match(/\((https?:\/\/.*?)\)/)) || [];
  const totalImages = imagesToUpload.length;

  if (totalImages === 0) {
    vscode.window.showInformationMessage('没有找到需要上传的本地图片');
    return;
  }

  await vscode.window.withProgress({
    location: vscode.ProgressLocation.Notification,
    title: "正在上传图片",
    cancellable: false
  }, async (progress, token) => {
    while ((match = imageRegex.exec(text)) !== null) {
      const imagePath: string = match[1];
      if (imagePath.startsWith('http')) { continue; }

      const fullImagePath: string = decodeFilePath(path.isAbsolute(imagePath) ? imagePath : path.join(path.dirname(document.uri.fsPath), imagePath));

      const currentMatch = match;

      let retries = 0;
      let uploadSuccess = false;

      while (retries < maxRetries && !uploadSuccess) {
        try {
          // 生成新的文件名
          const newFileName = generateUniqueFileName(fullImagePath, document.uri.fsPath);
          const newFilePath = path.join(path.dirname(fullImagePath), newFileName);

          // 复制并重命名文件
          fs.copyFileSync(fullImagePath, newFilePath);

          // 上传新文件
          const result = await picgo.upload([newFilePath]);

          // 删除临时文件
          fs.unlinkSync(newFilePath);

          if (Array.isArray(result) && result.length > 0 && result[0].imgUrl) {
            uploadedCount++;
            progress.report({ increment: 100 / totalImages, message: `已上传 ${uploadedCount}/${totalImages}` });

            replacements.push({
              range: new vscode.Range(
                document.positionAt(currentMatch.index),
                document.positionAt(currentMatch.index + currentMatch[0].length)
              ),
              newText: `![](${result[0].imgUrl})`
            });

            uploadSuccess = true;
          } else {
            throw new Error("上传结果无效");
          }
        } catch (error) {
          retries++;
          if (retries >= maxRetries) {
            failedCount++;
            let errorMessage = `图片上传失败: ${path.basename(fullImagePath)}`;
            if (error instanceof Error) {
              errorMessage += ` - ${error.message}`;
            }
            vscode.window.showErrorMessage(errorMessage);
          } else {
            // 如果还有重试机会,等待一段时间后继续
            await new Promise(resolve => setTimeout(resolve, uploadInterval));
          }
        }
      }

      // 每次上传后等待指定的间隔时间
      await new Promise(resolve => setTimeout(resolve, uploadInterval));
    }
  });

  if (replacements.length > 0) {
    await editor.edit(editBuilder => {
      for (let replacement of replacements) {
        editBuilder.replace(replacement.range, replacement.newText);
      }
    });
  }

  if (uploadedCount > 0 || failedCount > 0) {
    let message = `上传完成。成功：${uploadedCount}张`;
    if (failedCount > 0) {
      message += `，失败：${failedCount}张`;
    }
    vscode.window.showInformationMessage(message);
  } else {
    vscode.window.showInformationMessage('没有找到需要上传的本地图片');
  }
}

/**
 * 生成唯一的文件名
 * @param {string} originalPath - 原始文件路径
 * @returns {string} 新的文件名
 */
/**
 * 生成唯一的文件名
 * @param {string} originalPath - 原始文件路径
 * @param {string} mdFilePath - 当前 Markdown 文件的路径
 * @returns {string} 新的文件名
 */
function generateUniqueFileName(originalPath: string, mdFilePath: string): string {
  const ext = path.extname(originalPath);
  const baseName = path.basename(originalPath, ext);
  const mdFileName = path.basename(mdFilePath, path.extname(mdFilePath));
  const timestamp = Date.now();
  const randomString = crypto.randomBytes(4).toString('hex');
  return `${mdFileName}_${baseName}_${timestamp}_${randomString}${ext}`;
}

/**
 * 扩展被停用时调用此方法
 */
export function deactivate() { }
