# NVIDIA CEO market forecaster

This offline Node program forecasts the next 240 minutes for every market in a case. For each horizon it samples historical price changes from the latest 48 hours, estimates the five change quantiles, and applies a conservative spread adjustment. A 120-minute versus 48-hour realized-volatility ratio adapts that adjustment to current activity. Forecasts stay bounded to `[0, 1]` and are written in the contest's required JSON format.

Run with Node and the standard library only:

```sh
node main.ts
```
