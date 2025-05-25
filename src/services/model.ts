import RNFS from "react-native-fs";

export const downloadModel = async (
  modelName: string,
  modelUrl: string,
  onProgress: (progress: number) => void
): Promise<string> => {
  const destPath: string = `${RNFS.DocumentDirectoryPath}/${modelName}`;

  try {
    const fileExists: boolean = await RNFS.exists(destPath);

    if (fileExists) {
      await RNFS.unlink(destPath);
      console.log(`Deleted existing file at ${destPath}`);
    }

    console.log("right before download");
    console.log("modelUrl : ", modelUrl);

    const downloadResult = await RNFS.downloadFile({
      fromUrl: modelUrl,
      toFile: destPath,
      progressDivider: 1,
      begin: (res: RNFS.DownloadBeginCallbackResult) => {
        console.log("Response begin ===\n\n", res);
      },
      progress: (progressRes: RNFS.DownloadProgressCallbackResult) => {
        const { bytesWritten, contentLength } = progressRes;
        console.log("Response written ===\n\n", progressRes);
        const pct = (bytesWritten / contentLength) * 100;
        console.log("progress : ", pct);
        onProgress(Math.floor(pct));
      },
    }).promise;

    console.log("right after download");

    if (downloadResult.statusCode === 200) {
      return destPath;
    } else {
      throw new Error(`Download failed with status code: ${downloadResult.statusCode}`);
    }
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to download model: ${error.message}`);
    } else {
      throw new Error("Failed to download model: Unknown error");
    }
  }
};