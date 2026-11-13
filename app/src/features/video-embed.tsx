// The in-app player for a YouTube demo on phones (react-native-webview). The page is served with our site as its
// origin because YouTube refuses embeds that have none.
import { WebView } from 'react-native-webview';
import { youTubeEmbed } from '@/lib/library';

export function VideoEmbed({ id, title }: { id: string; title: string }) {
  const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;background:#000;height:100%}iframe{border:0;width:100%;height:100%}</style></head>
<body><iframe src="${youTubeEmbed(id)}" title="${title.replace(/[<>"&]/g, '')}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe></body></html>`;
  return (
    <WebView source={{ html, baseUrl: 'https://thedragonflycatalyst.github.io/' }} style={{ flex: 1, backgroundColor: '#000' }}
      allowsInlineMediaPlayback mediaPlaybackRequiresUserAction={false} allowsFullscreenVideo javaScriptEnabled
      // Only the player itself loads here; anything else (a tap on the YouTube logo) opens outside the app
      onShouldStartLoadWithRequest={(r) => r.url.startsWith('https://www.youtube-nocookie.com/') || r.url === 'about:blank' || r.url.startsWith('https://thedragonflycatalyst.github.io/')} />
  );
}
