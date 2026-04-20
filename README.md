# Barcelona-05-26

Static itinerary webpages published with GitHub Pages.

## Local structure

- `index.html`: current published landing page
- `styles.css`: shared styling
- `script.js`: shared behavior
- `raw/`: source itinerary files
- `.github/workflows/deploy-pages.yml`: automatic GitHub Pages deployment

## Publish to GitHub Pages

1. Create a GitHub repository under your account.
2. Push this project to the `main` branch.
3. In GitHub, open `Settings -> Pages`.
4. Ensure the source is set to `GitHub Actions`.
5. After the workflow finishes, the site will be available at the repository's GitHub Pages URL.

## Notes

- This workflow publishes the repository root as a static site.
- If the project grows to multiple itinerary pages, keep shared assets in place and link the pages from `index.html`.
