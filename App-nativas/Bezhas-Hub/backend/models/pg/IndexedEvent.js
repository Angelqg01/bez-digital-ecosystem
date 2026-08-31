const pool = require('../../db/pool');

class IndexedEventPG {
    static async create(data) {
        const query = `
            INSERT INTO indexed_events (
                contract_name, contract_address, event_name, event_signature,
                args, decoded_args, block_number, block_hash, block_timestamp,
                transaction_hash, transaction_index, log_index, chain_id, network
            ) VALUES (
                $1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8, $9, $10, $11, $12, $13, $14
            ) RETURNING *;
        `;

        // Pre-parse common args similar to Mongoose Pre-save hook
        const args = data.args || {};
        const decodedArgs = data.decodedArgs || {};
        
        if (!decodedArgs.from) {
            if (args.from) decodedArgs.from = args.from.toLowerCase();
            if (args.sender) decodedArgs.from = args.sender.toLowerCase();
        }
        if (!decodedArgs.to) {
            if (args.to) decodedArgs.to = args.to.toLowerCase();
            if (args.recipient) decodedArgs.to = args.recipient.toLowerCase();
        }
        if (!decodedArgs.user) {
            if (args.user) decodedArgs.user = args.user.toLowerCase();
            if (args.owner) decodedArgs.user = args.owner.toLowerCase();
        }
        if (args.tokenId) decodedArgs.tokenId = args.tokenId.toString();
        if (args.amount) decodedArgs.amount = args.amount.toString();
        if (args.value) decodedArgs.amount = args.value.toString();
        if (args.proposalId) decodedArgs.proposalId = args.proposalId.toString();
        if (args.postId) decodedArgs.postId = args.postId.toString();

        const values = [
            data.contractName,
            data.contractAddress,
            data.eventName,
            data.eventSignature,
            JSON.stringify(args),
            JSON.stringify(decodedArgs),
            data.blockNumber,
            data.blockHash,
            data.blockTimestamp,
            data.transactionHash,
            data.transactionIndex,
            data.logIndex,
            data.chainId || 137,
            data.network || 'polygon'
        ];

        try {
            const result = await pool.query(query, values);
            return result.rows[0];
        } catch (error) {
            if (error.code === '23505') { // Duplicate transaction_hash violation
                throw new Error('E11000 duplicate key error');
            }
            throw error;
        }
    }

    static async getUnprocessedEvents(limit = 100) {
        const query = `
            SELECT * FROM indexed_events
            WHERE processed = false
            ORDER BY block_number ASC
            LIMIT $1
        `;
        const result = await pool.query(query, [limit]);
        return result.rows;
    }

    static async markAsProcessed(eventIds, errorMsg = null) {
        if (!eventIds || eventIds.length === 0) return;
        
        let updateColumns = "processed = true, processed_at = CURRENT_TIMESTAMP";
        let params = [eventIds];
        
        if (errorMsg) {
            updateColumns += `, processing_error = $2`;
            params.push(errorMsg);
        }

        const query = `
            UPDATE indexed_events
            SET ${updateColumns}
            WHERE id = ANY($1::uuid[])
        `;
        return pool.query(query, params);
    }

    static async getEventsForUser(userAddress, options = {}) {
        const { limit = 50, skip = 0, eventNames = [], fromDate = null, toDate = null } = options;
        
        let baseQuery = `
            SELECT * FROM indexed_events
            WHERE (decoded_args->>'user' = $1 OR decoded_args->>'from' = $1 OR decoded_args->>'to' = $1)
        `;
        const params = [userAddress.toLowerCase()];
        let paramIdx = 2;

        if (eventNames.length > 0) {
            baseQuery += ` AND event_name = ANY($${paramIdx}::text[])`;
            params.push(eventNames);
            paramIdx++;
        }

        if (fromDate) {
            baseQuery += ` AND block_timestamp >= $${paramIdx}`;
            params.push(fromDate);
            paramIdx++;
        }

        if (toDate) {
            baseQuery += ` AND block_timestamp <= $${paramIdx}`;
            params.push(toDate);
            paramIdx++;
        }

        baseQuery += ` ORDER BY block_timestamp DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;
        params.push(limit, skip);

        const result = await pool.query(baseQuery, params);
        return result.rows;
    }
}

module.exports = IndexedEventPG;
