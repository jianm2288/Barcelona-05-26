# Barcelona-05-26

Static itinerary webpages published with GitHub Pages.

## Local structure

- `index.html`: landing page linking all published itineraries
- `pages/`: one HTML page per itinerary
- `styles.css`: shared styling
- `script.js`: shared behavior
- `raw/`: source itinerary files
- `scripts/generate_site.py`: generator that scans `raw/` and refreshes the landing page plus itinerary pages
- `site_manifest.json`: stable source-to-slug mapping for published itinerary pages
- `.github/workflows/deploy-pages.yml`: automatic GitHub Pages deployment

## Refresh generated pages

Run:

```bash
python scripts/generate_site.py
```

This regenerates `index.html` and `pages/*.html` from the supported source files in `raw/`.

## Publish to GitHub Pages

1. Create a GitHub repository under your account.
2. Push this project to the `main` branch.
3. In GitHub, open `Settings -> Pages`.
4. Ensure the source is set to `GitHub Actions`.
5. After the workflow finishes, the site will be available at the repository's GitHub Pages URL.

## Notes

- This workflow publishes the repository root as a static site.
- Multiple itinerary pages share the same layout, destination overview, and day-by-day tabbed route browser through the generator.
- Add new itinerary source files under `raw/`; if you want to preserve an existing page slug, add the mapping to `site_manifest.json`.
