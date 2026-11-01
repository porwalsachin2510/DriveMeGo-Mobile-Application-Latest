import { useMemo, useState } from "react";
import { Linking, Platform, Text } from "react-native";
import { WebView } from "react-native-webview";
import { colors, type } from "../theme";

const STYLE = `
  body{margin:0;padding:0;font-family:-apple-system,Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:${colors.text};word-wrap:break-word}
  h1,h2,h3,h4{color:${colors.navy};line-height:1.3;margin:20px 0 8px}
  h1{font-size:22px}h2{font-size:19px}h3{font-size:17px}
  p{margin:0 0 12px}ul,ol{padding-left:22px;margin:0 0 12px}li{margin-bottom:6px}
  a{color:${colors.tealDark}}img{max-width:100%;height:auto}
  table{width:100%;border-collapse:collapse}td,th{border:1px solid #D8E4EA;padding:6px;font-size:13px}
`;

const REPORT_HEIGHT = `
  (function(){
    function send(){window.ReactNativeWebView.postMessage(String(document.documentElement.scrollHeight));}
    window.addEventListener('load',send);
    new ResizeObserver(send).observe(document.body);
    send();
  })();
  true;
`;

const stripHtml = (html) =>
  String(html || "")
    .replace(/<\/(p|div|h[1-6]|li|br)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .trim();

export function HtmlContent({ html }) {
  const [height, setHeight] = useState(120);
  const source = useMemo(
    () => ({
      html: `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${STYLE}</style></head><body>${html || ""}</body></html>`,
    }),
    [html]
  );

  if (Platform.OS === "web") {
    return <Text style={type.body}>{stripHtml(html)}</Text>;
  }

  return (
    <WebView
      originWhitelist={["*"]}
      source={source}
      style={{ height, backgroundColor: "transparent" }}
      scrollEnabled={false}
      injectedJavaScript={REPORT_HEIGHT}
      onMessage={(e) => {
        const h = Number(e.nativeEvent.data);
        if (h > 0) setHeight(Math.ceil(h) + 8);
      }}
      onShouldStartLoadWithRequest={(req) => {
        if (req.url === "about:blank" || req.url.startsWith("data:")) return true;
        Linking.openURL(req.url).catch(() => {});
        return false;
      }}
    />
  );
}
