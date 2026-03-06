# Publication List

A web-based application for managing and generating formatted PDF documents of academic research publications.

## Overview

This application provides a streamlined interface for maintaining a personal list of research publications. It is designed for academic researchers who need to maintain an up-to-date, well-formatted list of their scholarly work. Publication data is stored persistently in the cloud and can be exported as a professionally formatted PDF at any time.

## Features

- **Add and manage publications** — Store details including authors, title, journal name, volume, page numbers, publication date, and DOI.
- **Persistent cloud storage** — Publication data and custom ordering are saved via Firebase Firestore and remain consistent across sessions and devices.
- **Custom ordering** — Publications can be manually reordered; the arrangement is preserved on reload.
- **LaTeX support** — Titles and journal names support LaTeX-style mathematical notation (e.g. `$\alpha$`, `$H_2O$`, `$E=mc^2$`), which is automatically converted to Unicode for display and PDF output.
- **PDF generation** — Export all publications or a selected subset as a formatted PDF document in a classic academic style, with author name highlighted in bold.
- **Best publications selection** — Select and export a curated subset of publications as a separate PDF.
- **Customisable PDF background** — Choose from preset paper colours or define a custom colour for the PDF background.

## Live Application

The application is accessible at:  
**[https://prasadsachchidanand.github.io/publication-list/](https://prasadsachchidanand.github.io/publication-list/)**

## Technology

- [React](https://react.dev/) — User interface
- [Vite](https://vite.dev/) — Build tooling
- [Firebase Firestore](https://firebase.google.com/docs/firestore) — Cloud database
- [jsPDF](https://github.com/parallax/jsPDF) — PDF generation
- [Tailwind CSS](https://tailwindcss.com/) — Styling
- [GitHub Actions](https://github.com/features/actions) — Automated deployment to GitHub Pages

## Author

**Sachchidanand Prasad**