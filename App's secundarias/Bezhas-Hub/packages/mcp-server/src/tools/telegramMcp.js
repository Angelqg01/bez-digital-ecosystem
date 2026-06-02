"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TELEGRAM_TOOLS = void 0;
exports.handleTelegramTool = handleTelegramTool;
exports.registerTelegramMcp = registerTelegramMcp;
var axios_1 = require("axios");
require("dotenv/config");
// Load these from environment
var TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
var TELEGRAM_CHAT_ID = process.env.TELEGRAM_SECURITY_CHAT_ID;
exports.TELEGRAM_TOOLS = [
    {
        name: "send_telegram_message",
        description: "Send a message proactively to the system Administrator via Telegram. Use this to report critical security alerts, summaries of platform status, or request human intervention. Do not overuse to avoid rate-limiting.",
        inputSchema: {
            type: "object",
            properties: {
                message: {
                    type: "string",
                    description: "The main content of the message. You can use markdown formatting (bold, italic, code blocks).",
                },
                severity: {
                    type: "string",
                    enum: ["low", "medium", "high", "critical"],
                    description: "The urgency of the message. High and critical will use more urgent emojis.",
                    default: "medium"
                }
            },
            required: ["message"],
        },
    }
];
function handleTelegramTool(name, args) {
    return __awaiter(this, void 0, void 0, function () {
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _a = name;
                    switch (_a) {
                        case "send_telegram_message": return [3 /*break*/, 1];
                    }
                    return [3 /*break*/, 3];
                case 1: return [4 /*yield*/, sendTelegramMessage(args)];
                case 2: return [2 /*return*/, _b.sent()];
                case 3: throw new Error("Unknown tool: ".concat(name));
            }
        });
    });
}
function sendTelegramMessage(args) {
    return __awaiter(this, void 0, void 0, function () {
        var message, _a, severity, finalMessage, response, error_1;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
                        return [2 /*return*/, {
                                content: [{
                                        type: "text",
                                        text: "Error: Missing TELEGRAM_BOT_TOKEN or TELEGRAM_SECURITY_CHAT_ID in environment setup. Please tell the administrator to configure these.",
                                    }],
                                isError: true,
                            }];
                    }
                    message = args.message, _a = args.severity, severity = _a === void 0 ? "medium" : _a;
                    finalMessage = message;
                    if (severity === "critical") {
                        finalMessage = "\uD83D\uDEA8 *CR\u00CDTICO* \uD83D\uDEA8\n\n".concat(message);
                    }
                    else if (severity === "high") {
                        finalMessage = "\u26A0\uFE0F *ALTA PRIORIDAD* \u26A0\uFE0F\n\n".concat(message);
                    }
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, axios_1.default.post("https://api.telegram.org/bot".concat(TELEGRAM_BOT_TOKEN, "/sendMessage"), {
                            chat_id: TELEGRAM_CHAT_ID,
                            text: finalMessage,
                            parse_mode: 'Markdown',
                            disable_web_page_preview: true
                        }, {
                            timeout: 5000,
                            headers: {
                                'Content-Type': 'application/json'
                            }
                        })];
                case 2:
                    response = _b.sent();
                    if (response.data.ok) {
                        return [2 /*return*/, {
                                content: [{
                                        type: "text",
                                        text: "Successfully sent message to Administrator on Telegram (Msg ID: ".concat(response.data.result.message_id, ")."),
                                    }],
                            }];
                    }
                    else {
                        return [2 /*return*/, {
                                content: [{
                                        type: "text",
                                        text: "Failed to send Telegram message. API returned: ".concat(JSON.stringify(response.data)),
                                    }],
                                isError: true,
                            }];
                    }
                    return [3 /*break*/, 4];
                case 3:
                    error_1 = _b.sent();
                    return [2 /*return*/, {
                            content: [{
                                    type: "text",
                                    text: "Network or internal error sending Telegram message: ".concat(error_1.message),
                                }],
                            isError: true,
                        }];
                case 4: return [2 /*return*/];
            }
        });
    });
}
function registerTelegramMcp(server) {
    var _this = this;
    server.tool("send_telegram_message", "Send a message proactively to the system Administrator via Telegram. Use this to report critical security alerts, summaries of platform status, or request human intervention. Do not overuse to avoid rate-limiting.", {
        message: {
            type: "string",
            description: "The main content of the message. You can use markdown formatting (bold, italic, code blocks).",
        },
        severity: {
            type: "string",
            enum: ["low", "medium", "high", "critical"],
            description: "The urgency of the message. High and critical will use more urgent emojis.",
        }
    }, function (args) { return __awaiter(_this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, sendTelegramMessage(args)];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    }); });
}
