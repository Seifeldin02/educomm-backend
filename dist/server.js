"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = require("http");
const url_1 = require("url");
const next_1 = __importDefault(require("next"));
const websocket_js_1 = require("./src/lib/websocket.js");
const dev = process.env.NODE_ENV !== 'production';
const app = (0, next_1.default)({ dev });
const handle = app.getRequestHandler();
app.prepare().then(() => {
    const server = (0, http_1.createServer)((req, res) => {
        if (!req.url) {
            res.statusCode = 400;
            res.end('Bad Request');
            return;
        }
        const parsedUrl = (0, url_1.parse)(req.url, true);
        handle(req, res, parsedUrl);
    });
    // Set up WebSocket server
    const wss = (0, websocket_js_1.setupWebSocketServer)(server);
    console.log('WebSocket server set up');
    server.listen(3000, () => {
        console.log('> Ready on http://localhost:3000');
    });
});
