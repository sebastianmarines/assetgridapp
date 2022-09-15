export const routes = {
    dashboard: () => "/",
    importCsv: () => "/import/csv/",
    transactions: () => "/transactions/",
    transaction: (id: string) => "/transaction/" + id,
    createTransaction: () => "/transactions/create",
    account: (id: string) => "/account/" + id,
    accounts: () => "/accounts/",
    preferences: () => "/preferences",
};
