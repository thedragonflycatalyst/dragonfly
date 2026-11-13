// The in-app player on the web: a plain YouTube embed
import { createElement } from 'react';
import { youTubeEmbed } from '@/lib/library';

export function VideoEmbed({ id, title }: { id: string; title: string }) {
  return createElement('iframe', {
    src: youTubeEmbed(id), title, allow: 'autoplay; encrypted-media; picture-in-picture; fullscreen', allowFullScreen: true,
    style: { border: 0, width: '100%', height: '100%' },
  });
}
