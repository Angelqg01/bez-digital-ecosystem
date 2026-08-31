const express = require('express');
const {
    buildManifest,
    getCapabilityTarget,
    getSubappRegistry
} = require('../control-plane/policy');

const router = express.Router();

router.get('/manifest', (req, res) => {
    res.json(buildManifest());
});

router.get('/subapps', (req, res) => {
    res.json({
        hubRole: 'control-plane',
        subapps: getSubappRegistry()
    });
});

router.get('/capabilities/:capability', (req, res) => {
    const target = getCapabilityTarget(req.params.capability);

    if (!target) {
        return res.status(404).json({
            error: 'Not Found',
            code: 'UNKNOWN_CAPABILITY',
            capability: req.params.capability
        });
    }

    return res.json(target);
});

module.exports = router;
