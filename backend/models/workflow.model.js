const mongoose = require('mongoose');

const StepSchema = new mongoose.Schema({
    toolId: { type: String, required: true },
    toolName: { type: String },
    category: { type: String },
    params: { type: mongoose.Schema.Types.Mixed, default: {} },
    condition: { type: String, default: '' }, // optional JS expression
    order: { type: Number, required: true },
});

const RunLogSchema = new mongoose.Schema({
    runId: { type: String },
    startedAt: { type: Date },
    finishedAt: { type: Date },
    status: { type: String, enum: ['running', 'success', 'failed', 'cancelled'], default: 'running' },
    stepResults: [{
        stepIndex: Number,
        toolId: String,
        startedAt: Date,
        finishedAt: Date,
        input: mongoose.Schema.Types.Mixed,
        output: mongoose.Schema.Types.Mixed,
        error: String,
        status: { type: String, enum: ['success', 'failed', 'skipped'] },
    }],
    triggeredBy: { type: String },
});

const WorkflowSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String, default: '' },
    steps: [StepSchema],
    trigger: {
        type: { type: String, enum: ['manual', 'cron', 'webhook', 'event'], default: 'manual' },
        cronExpression: { type: String },
        webhookSecret: { type: String },
        eventName: { type: String },
    },
    createdBy: { type: String, required: true }, // wallet address
    status: { type: String, enum: ['active', 'paused', 'draft'], default: 'draft' },
    tags: [String],
    runHistory: [RunLogSchema],
    lastRun: { type: Date },
    totalRuns: { type: Number, default: 0 },
    blockchain: {
        onChainId: { type: Number },
        contractAddress: { type: String },
        txHash: { type: String },
        isVerified: { type: Boolean, default: false },
        chainId: { type: Number, default: 137 } // default Polygon/Amoy
    },
}, {
    timestamps: true,
});

WorkflowSchema.index({ createdBy: 1 });
WorkflowSchema.index({ status: 1 });
WorkflowSchema.index({ 'trigger.type': 1 });
WorkflowSchema.index({ 'blockchain.onChainId': 1 });
WorkflowSchema.index({ 'blockchain.txHash': 1 });

module.exports = mongoose.model('Workflow', WorkflowSchema);
