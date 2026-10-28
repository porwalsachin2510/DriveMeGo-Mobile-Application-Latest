import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";
import { colors, radius } from "../theme";

const buildHtml = ({ marker, destination, label, vehicle }) => {
  const lat = marker?.latitude ?? destination?.latitude ?? 25.2048;
  const lng = marker?.longitude ?? destination?.longitude ?? 55.2708;
  const data = JSON.stringify({ marker, destination, label, vehicle, lat, lng });
  return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>html,body,#map{height:100%;margin:0;background:#EAF4F7}
.pin{width:30px;height:30px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#0B2A4A;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3)}
.dest{background:#16A34A}.veh{border-radius:50%;transform:none;background:#0A8F9E;box-shadow:0 0 0 8px rgba(18,179,193,.25),0 2px 6px rgba(0,0,0,.3)}
.lbl{background:#fff;border-radius:12px;padding:2px 8px;font:600 11px sans-serif;color:#0B2A4A;border:none;box-shadow:0 1px 4px rgba(0,0,0,.2)}</style></head>
<body><div id="map"></div><script>
var d=${data};
var map=L.map('map',{zoomControl:true,attributionControl:true}).setView([d.lat,d.lng],14);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(map);
var pts=[];
function icon(c){return L.divIcon({className:'',html:'<div class="pin '+c+'"></div>',iconSize:[30,30],iconAnchor:[15,30]});}
if(d.marker){var m=L.marker([d.marker.latitude,d.marker.longitude],{icon:icon(d.vehicle?'veh':'')}).addTo(map);
if(d.label){m.bindTooltip(d.label,{permanent:true,direction:'top',className:'lbl',offset:[0,-28]});}pts.push([d.marker.latitude,d.marker.longitude]);}
if(d.destination){L.marker([d.destination.latitude,d.destination.longitude],{icon:icon('dest')}).addTo(map);pts.push([d.destination.latitude,d.destination.longitude]);}
if(pts.length>1){L.polyline(pts,{color:'#12B3C1',weight:4,dashArray:'6 8'}).addTo(map);map.fitBounds(pts,{padding:[40,40]});}
</script></body></html>`;
};

export function LiveMap({ marker, destination, label, vehicle = false, height = 260 }) {
  const key = `${marker?.latitude}-${marker?.longitude}-${destination?.latitude}-${destination?.longitude}`;
  const html = useMemo(() => buildHtml({ marker, destination, label, vehicle }), [key, label, vehicle]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <View style={[styles.wrap, { height }]}>
      <WebView
        key={key}
        originWhitelist={["*"]}
        source={{ html }}
        style={styles.web}
        scrollEnabled={false}
        javaScriptEnabled
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: radius.xl, overflow: "hidden", backgroundColor: "#EAF4F7", borderWidth: 1, borderColor: colors.border },
  web: { flex: 1, backgroundColor: "transparent" },
});
