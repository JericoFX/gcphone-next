import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'gcphone-next',
  description: 'Modern FiveM Phone - Documentation',
  base: '/gcphone-next/',

  themeConfig: {
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Getting Started', link: '/getting-started' },
      { text: 'API', link: '/api/exports' },
    ],

    sidebar: [
      {
        text: 'Introduction',
        items: [
          { text: 'Overview', link: '/' },
          { text: 'Getting Started', link: '/getting-started' },
        ],
      },
      {
        text: 'Apps',
        collapsed: false,
        items: [
          { text: 'Bank', link: '/apps/bank' },
          { text: 'Calls', link: '/apps/calls' },
          { text: 'Chirp', link: '/apps/chirp' },
          { text: 'Clips', link: '/apps/clips' },
          { text: 'Contacts', link: '/apps/contacts' },
          { text: 'Dark Rooms', link: '/apps/darkrooms' },
          { text: 'Documents', link: '/apps/documents' },
          { text: 'Gallery', link: '/apps/gallery' },
          { text: 'Garage', link: '/apps/garage' },
          { text: 'Mail', link: '/apps/mail' },
          { text: 'Messages', link: '/apps/messages' },
          { text: 'Music', link: '/apps/music' },
          { text: 'News', link: '/apps/news' },
          { text: 'Notes', link: '/apps/notes' },
          { text: 'Notifications', link: '/apps/notifications' },
          { text: 'Snap', link: '/apps/snap' },
          { text: 'Wallet', link: '/apps/wallet' },
          { text: 'Yellow Pages', link: '/apps/yellowpages' },
          { text: 'Radio', link: '/apps/radio' },
          { text: 'Services', link: '/apps/services' },
          { text: 'MatchMyLove', link: '/apps/matchmylove' },
          { text: 'CityRide', link: '/apps/cityride' },
        ],
      },
      {
        text: 'API Reference',
        collapsed: false,
        items: [
          { text: 'Exports', link: '/api/exports' },
          { text: 'Events', link: '/api/events' },
          { text: 'Callbacks', link: '/api/callbacks' },
          { text: 'Hooks', link: '/api/hooks' },
          { text: 'NUI Callbacks', link: '/api/nui-callbacks' },
        ],
      },
      {
        text: 'Guides',
        collapsed: false,
        items: [
          { text: 'Adding an App', link: '/guides/adding-app' },
          { text: 'LiveKit Setup', link: '/guides/livekit-setup' },
          { text: 'Socket.IO Setup', link: '/guides/socket-setup' },
          { text: 'Framework Bridge', link: '/guides/framework-bridge' },
        ],
      },
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/JericoFX/gcphone-next' },
    ],

    search: {
      provider: 'local',
    },

    footer: {
      message: 'Released under GPL-3.0 License',
      copyright: 'Maintained by JericoFX',
    },
  },
})
