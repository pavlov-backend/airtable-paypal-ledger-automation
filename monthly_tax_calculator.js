// --- MONTHLY 1% TAX CALCULATION ENGINE ---

const SOURCE_TABLE_NAME = 'Book Income | Expense IE 322767822';
const DESTINATION_TABLE_NAME = 'Paying Taxes';
const TAX_RATE = 0.01;

try {
    const today = new Date();
    const endOfPreviousMonth = new Date(today.getFullYear(), today.getMonth(), 0);
    const startOfPreviousMonth = new Date(endOfPreviousMonth.getFullYear(), endOfPreviousMonth.getMonth(), 1);
    
    const year = startOfPreviousMonth.getFullYear();
    const monthIndex = startOfPreviousMonth.getMonth();
    const monthName = startOfPreviousMonth.toLocaleString('en-US', { month: 'long' });

    console.log(`Calculating taxes for: ${monthName} ${year}`);

    const sourceTable = base.getTable(SOURCE_TABLE_NAME);
    const query = await sourceTable.selectRecordsAsync({
        fields: ['Amount GEL', 'Date Document', 'Type Transaction']
    });

    // Filtering for monthly Income
    const incomeRecords = query.records.filter(record => {
        const type = record.getCellValue('Type Transaction');
        const dateStr = record.getCellValue('Date Document');
        if (!type || type.name !== 'Income' || !dateStr) return false;
        
        const d = new Date(dateStr);
        return d.getFullYear() === year && d.getMonth() === monthIndex;
    });

    if (incomeRecords.length > 0) {
        let totalRevenueGEL = incomeRecords.reduce((sum, r) => sum + (parseFloat(r.getCellValue('Amount GEL')) || 0), 0);
        const taxAmountGEL = parseFloat((totalRevenueGEL * TAX_RATE).toFixed(2));

        const destinationTable = base.getTable(DESTINATION_TABLE_NAME);
        await destinationTable.createRecordAsync({
            'Month': { name: monthName },
            'Revenue': totalRevenueGEL,
            'Amount': taxAmountGEL,
            'Status': { name: 'Pending' }
        });
        
        console.log(`Tax entry created: ${taxAmountGEL} GEL`);
    }
} catch (e) {
    console.error(e);
}
