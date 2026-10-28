import { Platform } from "react-native";
import { Directory, File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { API_BASE } from "../config/env";
import { getAuthToken } from "../api/client";

export async function downloadAndShare(path, fileName, mimeType = "application/pdf") {
  if (Platform.OS === "web") {
    window.open(`${API_BASE}${path}`, "_blank");
    return;
  }
  const token = getAuthToken();
  const destination = new File(new Directory(Paths.cache), fileName);
  if (destination.exists) destination.delete();
  const file = await File.downloadFileAsync(`${API_BASE}${path}`, destination, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error("Sharing is not available on this device.");
  }
  await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: fileName, UTI: "com.adobe.pdf" });
}
