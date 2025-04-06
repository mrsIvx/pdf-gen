# PDF Generator

A web application for generating and manipulating PDF files.

## Features

- PDF generation and manipulation
- Image processing capabilities
- WebSocket support for real-time operations
- Express.js backend with React frontend

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- ImageMagick (for image processing)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/pdf-generator.git
cd pdf-generator
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
Create a `.env` file in the root directory with necessary configuration.

4. Start the development server:
```bash
npm run dev
```

## Project Structure

```
├── config/         # Configuration files
├── public/         # Static files
├── spotify/        # Spotify integration
├── utils/          # Utility functions
├── server.js       # Main server file
├── index.js        # Application entry point
└── package.json    # Project dependencies
```

## Available Scripts

- `npm start` - Start the production server
- `npm run dev` - Start the development server with hot reload
- `npm test` - Run tests

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the ISC License.
