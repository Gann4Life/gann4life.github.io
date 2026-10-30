---
title: Shiki
kind: game
context: personal
roles:
  - programmer
  - director
  - technical-direction
authorship: hand-made
origin: original
team: solo
credits: []
contribution: Core game logic & networking using PUN2
status: in-development
started: 2026-10-29
featured: true
draft: false
tools:
  - Unity
cover: ../../assets/shiki/cover.png
gallery: []
media: []
links:
  - label: itch.io page
    type: download
    url: https://gann4life.itch.io/shiki
usedIn: []
---
An online multiplayer prototype made with PUN2.\
\
**What i learned so far**

***Remote Procedure Calls***

I finally managed to understand how RPC methods work, this is how i understand it: `When you execute a RPC method, it's done from a client, which sends the information to the server and other players can recieve it. (You are basically telling everyone in the room "hey, look at me right now!" )`. I know this is kinda wrong, i am not really good explaining stuff, much less when i am still trying to understand it (but in my mind it makes sense how it works lol)

I found information in google about it but i wasn't able to understand it. "Remote Procedure Calls (RPC) are exactly what the name implies: method-calls on remote clients in the same room.", now that i have my own understanding of it, this makes sense.

This is essential for networking, i might be able to make more online games with this thanks to PUN2.

***Tileset creation with Clip Studio Paint&nbsp;(Removed art)***

I havent made much, but now i know how to make tilesets with Clip Studio Paint (which i thought that it wasn't possible)

This implies being able to create layer instances of another file, so when you modify the source file, all the instances will reflect these changes, which saves up work and time.

Tilesets are done on a grid that CSP offers, so its much easier to import into Unity.
