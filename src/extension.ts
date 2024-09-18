import * as vscode from 'vscode';
import { PicGo } from 'picgo';
import * as path from 'path';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

  let uploadImagesCommand = vscode.commands.registerCommand('one-picgo.uploadImages', async () => {
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
    // 从 VS Code 配置中获取 PicGo 配置
    const config = vscode.workspace.getConfiguration('one-picgo');
    const picBed = config.get('config');
    picgo.setConfig({
      picBed
    });

    await uploadAndReplaceImages(editor, document, picgo);
  });

  context.subscriptions.push(uploadImagesCommand);
}

async function uploadAndReplaceImages(editor: vscode.TextEditor, document: vscode.TextDocument, picgo: PicGo) {
  const text: string = document.getText();
  const imageRegex: RegExp = /!\[.*?\]\((.*?)\)/g;
  let match: RegExpExecArray | null;

  let replacements: { range: vscode.Range; newText: string }[] = [];

  // 从配置中获取上传间隔时间(毫秒)，默认为1000毫秒
  const config = vscode.workspace.getConfiguration('one-picgo');
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
    let uploadedCount = 0;

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
          console.error('上传图片失败:', result);
          vscode.window.showErrorMessage(`上传图片失败: ${imagePath}`);
        }
      } catch (error) {
        console.error('上传图片失败:', error);
        vscode.window.showErrorMessage(`上传图片失败: ${imagePath}`);
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

  // 显示上传完成的消息
  vscode.window.showInformationMessage(`图片上传和替换完成，共上传 ${replacements.length} 张图片`);
}

// This method is called when your extension is deactivated
export function deactivate() { }
