# Arium

A gamified fitness mobile app built with Apache Cordova. Fitness as an RPG — complete daily objectives, earn XP, level up, and maintain your streak.

## Features

- **Daily Quest board** — 4 objectives to complete each day, tracked in SQLite
- **XP & leveling** — earn XP for completions, lose XP for missed days
- **Streak system** — consecutive-day bonus tracking with a penalty for skipped days
- **Trial mode** — pick an exercise, run a timer or rep counter, earn XP on completion
- **Profile page** — avatar, level, XP bar, streak, and lifetime stats

## Stack

- Apache Cordova (targets Android + browser)
- Vanilla HTML / CSS / JS — no framework, no build tool
- `cordova-sqlite-storage` — persistent objectives (`fitness.db`)
- `localStorage` — XP, level, streak, and daily reset state

## Pages

| File | Purpose |
|------|---------|
| `www/index.html` | Dashboard: player name, animated XP bar, daily quest card |
| `www/trial.html` | Trial mode: exercise picker → timer/rep counter → reward |
| `www/profile.html` | Profile: avatar, level, XP bar, streak, total stats |

## XP System

| Action | XP |
|--------|----|
| Daily objective completed | +25 |
| Trial exercise completed | +15 |
| Previous day's objectives missed | -50 + streak reset |

Level = `floor(totalXP / 100) + 1`

## Getting Started

```bash
# Install dependencies
npm install

# Add a platform
cordova platform add android
cordova platform add browser

# Run in browser
cordova run browser

# Build for Android
cordova build android
```

## Project Structure

```
www/
  index.html        # Dashboard
  trial.html        # Trial mode
  profile.html      # Profile
  js/
    index.js        # Daily quest logic, XP animations, SQLite
    trial.js        # Trial mode flow
    profil.js       # Profile rendering
    shared.js       # Shared utilities
    notifications.js
  css/
    index.css
    trial.css
    profile.css
  img/              # SVG icons + logo
config.xml          # Cordova app config (id: com.arium.app, v1.0.0)
```

## Author

Pierre-Louis — pierre.louis.sans@gmail.com
