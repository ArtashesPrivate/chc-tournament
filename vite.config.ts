import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({plugins:[react(),VitePWA({registerType:'autoUpdate',includeAssets:['icon.svg'],manifest:{name:'CHC Tournament',short_name:'CHC Toernooi',description:'Toernooiplanning, live uitslagen en standen voor SV CHC.',theme_color:'#073b2c',background_color:'#f4f7f5',display:'standalone',orientation:'any',start_url:'/',scope:'/',icons:[{src:'/icon.svg',sizes:'any',type:'image/svg+xml',purpose:'any maskable'}]},workbox:{navigateFallback:'/index.html',globPatterns:['**/*.{js,css,html,svg}']}})]})
