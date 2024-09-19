import * as vscode from 'vscode';
import { PicGo } from 'picgo';
import * as path from 'path';

let outputChannel: vscode.OutputChannel;

/**
 * 激活扩展
 * @param context - 扩展上下文
 */
export function activate(context: vscode.ExtensionContext) {
  outputChannel = vscode.window.createOutputChannel("VS-MDAllInPicGo");

  let uploadImagesCommand = vscode.commands.registerCommand('vs-mdallinpicgo.uploadImages', async () => {
    try {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showErrorMessage('没有打开的编辑器');
        return;
      }

      const document = editor.document;
      if (document.languageId !== 'markdown') {
        vscode.window.showErrorMessage('当前文件不是 Markdown 文件');
        return;
      }

      const picgo = new PicGo();
      // PicGo 将自动加载其默认配置文件

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

  context.subscriptions.push(uploadImagesCommand);
}

/**
 * 上传并替换 Markdown 文件中的本地图片
 * @param editor - VS Code 文本编辑器
 * @param document - 当前文档
 * @param picgo - PicGo 实例
 */
async function uploadAndReplaceImages(editor: vscode.TextEditor, document: vscode.TextDocument, picgo: PicGo) {
  const text: string = document.getText();
  const imageRegex: RegExp = /!\[.*?\]\((.*?)\)/g;
  let match: RegExpExecArray | null;

  let replacements: { range: vscode.Range; newText: string }[] = [];
  let uploadedCount = 0;
  let failedCount = 0;

  // 从配置中获取上传间隔时间(毫秒)，默认为1000毫秒
  const config = vscode.workspace.getConfiguration('vs-mdallinpicgo');
  const uploadInterval = config.get('uploadInterval', 1000);

  // 计算需要上传的图片总数
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
    // 遍历文档中的所有图片链接
    while ((match = imageRegex.exec(text)) !== null) {
      const imagePath: string = match[1];
      if (imagePath.startsWith('http')) { continue; } // 跳过已经是网络图片的链接

      // 获取完整的图片路径
      const fullImagePath: string = path.isAbsolute(imagePath) ? imagePath : path.join(path.dirname(document.uri.fsPath), imagePath);

      const currentMatch = match; // 保存当前匹配结果的副本

      try {
        // 上传图片
        const result = await picgo.upload([fullImagePath]);

        // 更新进度
        uploadedCount++;
        progress.report({ increment: 100 / totalImages, message: `已上传 ${uploadedCount}/${totalImages}` });

        // 添加时间间隔
        await new Promise(resolve => setTimeout(resolve, uploadInterval));

        if (Array.isArray(result) && result.length > 0 && result[0].imgUrl) {
          // 如果上传成功，准备替换文本
          replacements.push({
            range: new vscode.Range(
              document.positionAt(currentMatch.index),
              document.positionAt(currentMatch.index + currentMatch[0].length)
            ),
            newText: `![](${result[0].imgUrl})`
          });
        } else {
          failedCount++;
        }
      } catch (error) {
        failedCount++;
      }
    }
  });

  // 批量替换文本
  if (replacements.length > 0) {
    await editor.edit(editBuilder => {
      for (let replacement of replacements) {
        editBuilder.replace(replacement.range, replacement.newText);
      }
    });
  }

  // 显示上传结果
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
 * 扩展被停用时调用此方法
 */
export function deactivate() { }
