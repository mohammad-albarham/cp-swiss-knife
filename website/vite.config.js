"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vite_1 = require("@sveltejs/kit/vite");
const vite_2 = __importDefault(require("@tailwindcss/vite"));
const vite_3 = require("vite");
exports.default = (0, vite_3.defineConfig)({
    plugins: [(0, vite_2.default)(), (0, vite_1.sveltekit)()]
});
//# sourceMappingURL=vite.config.js.map