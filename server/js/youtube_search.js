let YouTube = null;
try {
  YouTube = require('youtube-sr').default;
} catch (e) {
  YouTube = null;
  console.warn('[gcphone] youtube-sr not installed — music search disabled');
}

exports('youtubeSearch', async (query, maxResults) => {
  if (!YouTube) return JSON.stringify({ success: false, error: 'YOUTUBE_SR_NOT_INSTALLED', results: [] });

  query = String(query || '').trim().slice(0, 80);
  maxResults = Math.max(1, Math.min(20, Number(maxResults) || 8));
  if (!query) return JSON.stringify({ success: true, results: [] });

  try {
    const results = await YouTube.search(query, { limit: maxResults, type: 'video' });
    const out = results.map(v => ({
      videoId: v.id || '',
      title: (v.title || '').slice(0, 160),
      channel: (v.channel?.name || '').slice(0, 80),
      thumbnail: v.thumbnail?.url || '',
      duration: v.durationFormatted || '',
      views: v.views || 0,
      url: v.url || '',
    }));
    return JSON.stringify({ success: true, results: out });
  } catch (err) {
    console.error('[gcphone] youtube-sr search failed:', err.message);
    return JSON.stringify({ success: false, error: 'SEARCH_FAILED', results: [] });
  }
});
