# VS-MDAllInPicGo

[English](README.md) | [中文](./docs/README.zh.md)

VS-MDAllInPicGo is a Visual Studio Code extension that helps you quickly upload local images in Markdown files to an image hosting service and automatically replace the image links.

## Usage

1. Configure PicGo

   First, you need to configure your image hosting service information. Run the following command in the terminal:

   ```bash
   npx picgo set uploader
   ```

   Follow the prompts to select the image hosting service you want to use and fill in the relevant information. This will automatically generate the PicGo configuration file.

   Default PicGo configuration file paths:
   - Windows: `C:\Users\[YourUsername]\.picgo\config.json`
   - Linux: `~/.picgo/config.json`
   - macOS: `~/.picgo/config.json`

   You can directly edit this file to modify the configuration, or use the `npx picgo set` command to change settings.

2. Install VS-MDAllInPicGo Extension

   Search for "VS-MDAllInPicGo" in the VS Code extension marketplace and install it.

3. Use the Extension

   - Open a Markdown file
   - Right-click in the editor, select "Upload and Replace Local Images in Markdown to Image Hosting Service" from the context menu
   - The extension will automatically upload all local images in the file and replace them with image hosting service links

4. Demo
![Demo](./docs/demo.gif)

## Notes

- Ensure your PicGo configuration file is set up correctly, otherwise uploads may fail
- Uploading a large number of images may take some time, please be patient
- If errors occur during the upload process, please check the output panel for detailed information
- If you need to change image hosting service settings, you can directly edit the PicGo configuration file

## Feedback

If you encounter any issues while using this extension or have any suggestions, please feel free to raise an issue in the GitHub repository.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.