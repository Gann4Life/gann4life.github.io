---
title: RagAssembler2D
kind: software
context: personal
position: Director / Designer
roles:
  - director
  - designer
  - spec-author
  - maintainer
authorship: ai-built
origin: original
team: solo
credits: []
contribution: >
  Came up with the tool, wrote its product spec (DESIGN.md) and the design
  decisions in docs/, and directed and reviewed the implementation, which was
  written with AI.
status: in-development
started: 2026-10-14
featured: true
draft: false
tools:
  - JavaScript
  - PIXI.js
  - LiquidFun
  - Node.js
cover: ../../assets/ragassembler2d/cover.gif
gallery: []
media:
  - type: webgl
    src: https://gann4life.github.io/RagAssembler2D/
    caption: >-
      The live editor. Open it full screen from the link below for the best
      experience.
links:
  - label: Open the editor
    type: play
    url: https://gann4life.github.io/RagAssembler2D/
  - label: Design spec (DESIGN.md)
    type: docs
    url: https://github.com/Gann4Life/RagAssembler2D/blob/main/DESIGN.md
  - type: source
    url: https://github.com/Gann4Life/RagAssembler2D
usedIn: []
---
Browser-based editor for building and animating active ragdolls for games that
use LiquidFun (Box2D) with PIXI.js rendering. It ships with RagImporter, a
runtime library that loads exported ragdolls into any game.

- **Rigging:** shapes (circles, boxes, convex polygons) grouped into bodies,
  connected with joints, with sprites attached.
- **Animation:** a Godot-style timeline that drives joint motors instead of
  moving shapes directly.
- **Simulation:** the editor runs the same runtime as the final game.
- **Runtime control:** play clips, react to events, and blend procedural joint
  control.

Pre-alpha: the spec is complete and implementation has started.
