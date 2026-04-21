// --- PAYPAL PAYOUTS SEARCH & ENRICHMENT - v6.5 ---

const PAYPAL_API_BASE = 'https://api-m.paypal.com';
const NBG_API_BASE = 'https://nbg.gov.ge/gw/api/ct/monetarypolicy/currencies/en/json';
const TARGET_TABLE_NAME = 'Book Income | Expense IE 322767822';

console.log('Initializing script: Fetching and enriching PayPal payouts...');

/**
 * Fetches the official NBG exchange rate for a specific date.
 * Includes a 5-day look-back fallback logic for holidays/weekends.
 */
async function getNbgRateForDate(transactionDate) {
    for (let i = 0; i < 5; i++) {
        let dateToFetch = new Date(transactionDate); 
        dateToFetch.setDate(dateToFetch.getDate() - i);
        const dateString = dateToFetch.toISOString().split('T')[0];
        try {
            const nbgResponse = await fetch(`${NBG_API_BASE}?date=${dateString}`);
            if (nbgResponse.ok) {
                const nbgData = await nbgResponse.json(); 
                const usdRateInfo = nbgData[0]?.currencies.find(c => c.code === 'USD');
                if (usdRateInfo) {
                    console.log(`...Rate for ${dateString} found: ${usdRateInfo.rate}`);
                    return usdRateInfo.rate;
                }
            }
        } catch (nbgError) {
            console.error(`NBG API Error for date ${dateString}:`, nbgError);
        }
    }
    return null;
}

// MAIN LOGIC
try {
    const inputConfig = input.config();
    let overallStartDate = new Date(inputConfig.startDate);
    let overallEndDate = new Date(inputConfig.endDate);

    // 1. OAUTH 2.0 TOKEN EXCHANGE
    console.log('Requesting PayPal Access Token...');
    const clientId = await input.secret('paypalClientId');
    const clientSecret = await input.secret('paypalSecretKey');
    const authResponse = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
        },
        body: 'grant_type=client_credentials'
    });
    
    if (!authResponse.ok) throw new Error(`PayPal Auth Failed: ${authResponse.status}`);
    const authData = await authResponse.json();
    const accessToken = authData.access_token;

    // 2. FETCH TRANSACTIONS IN 30-DAY CHUNKS
    let allTransactions = [];
    let currentStartDate = new Date(overallStartDate);
    while (currentStartDate <= overallEndDate) {
        let chunkEndDate = new Date(currentStartDate);
        chunkEndDate.setDate(chunkEndDate.getDate() + 30);
        if (chunkEndDate > overallEndDate) chunkEndDate = new Date(overallEndDate);

        const paypalStartDate = `${currentStartDate.toISOString().split('T')[0]}T00:00:00.000Z`;
        const paypalEndDate = `${chunkEndDate.toISOString().split('T')[0]}T23:59:59.999Z`;
        
        let nextPageUrl = `${PAYPAL_API_BASE}/v1/reporting/transactions?start_date=${paypalStartDate}&end_date=${paypalEndDate}&fields=all&page_size=500`;
        
        do {
            const res = await fetch(nextPageUrl, {
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` }
            });
            const pageData = await res.json();
            if (pageData.transaction_details) allTransactions.push(...pageData.transaction_details);
            nextPageUrl = pageData.links?.find(link => link.rel === 'next')?.href || null;
        } while (nextPageUrl);
        
        currentStartDate.setDate(chunkEndDate.getDate() + 1);
    }

    // 3. FILTER FOR SUCCESSFUL WITHDRAWALS (Event T0200)
    const successfulPayouts = allTransactions.filter(tx => 
        tx.transaction_info?.transaction_event_code === 'T0200' && 
        tx.transaction_info?.transaction_status === 'S'
    );

    // 4. MAP TO AIRTABLE SCHEMA
    let recordsToCreate = [];
    const currentDate = new Date().toISOString().split('T')[0];

    for (const payout of successfulPayouts) {
        const txInfo = payout.transaction_info;
        const currency = txInfo.transaction_amount?.currency_code;
        const amount = Math.abs(parseFloat(txInfo.transaction_amount?.value));
        
        let rate = await getNbgRateForDate(txInfo.transaction_initiation_date);
        let amountUSD = (currency === 'USD') ? amount : parseFloat((amount / rate).toFixed(2));
        
        recordsToCreate.push({
            fields: {
                'Number Document': txInfo.transaction_id,
                'Date Document': txInfo.transaction_initiation_date,
                'Date': currentDate,
                'Official rate': rate,
                'Good Or Service': 'Withdrawal to a bank card',
                'Amount USD': amountUSD,
                'Type Transaction': { name: 'Expense' },
                'Type Document': { name: 'Receipt' },
                'Notes': `PayPal Transaction ID: ${txInfo.transaction_id}`
            }
        });
    }

    // 5. BATCH CREATE RECORDS
    if (recordsToCreate.length > 0) {
        const targetTable = base.getTable(TARGET_TABLE_NAME);
        await targetTable.createRecordsAsync(recordsToCreate);
        console.log(`Success: Created ${recordsToCreate.length} records.`);
    }
} catch (error) {
    console.error('Global Execution Error:', error);
}
