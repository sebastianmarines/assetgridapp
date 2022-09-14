import * as React from "react";
import { Route, Routes  } from "react-router";
import { routes } from "../lib/routes";
import PageTransactions from "./transaction/PageTransactions";
import PageCreateTransaction from "./transaction/PageCreateTransaction";
import PageDashboard from "./pages/PageDashboard";
import PageImportCsv from "./import/PageImportCsv";
import PageAccount from "./account/PageAccount";
import { Preferences } from "../models/preferences";
import axios from "axios";
import PagePreferences from "./pages/PagePreferences";
import PageAccountOverview from "./account/PageAccountOverview";
import { Api } from "../lib/ApiClient";
import Sidebar from "./common/Sidebar";

export const preferencesContext = React.createContext<PreferencesContext>({ preferences: "fetching", updatePreferences: () => 0 });

interface PreferencesContext {
    preferences: Preferences | "fetching";
    updatePreferences: (newPreferences: Preferences) => void;
}

export default function FairFitPortalApp () {
    const [preferences, setPreferences] = React.useState<Preferences | "fetching">("fetching");

    React.useEffect(() => updatePreferences(null), []);

    return <React.StrictMode>
        <preferencesContext.Provider value={{ preferences: preferences, updatePreferences }}>
            <div style={{display: "flex", flexGrow: 1}}>
                <Sidebar />
                <div style={{ flexGrow: 1, backgroundColor: "#EEE" }}>
                    <Routes>
                        <Route path={routes.dashboard()} element={<PageDashboard />} />
                        <Route path={routes.importCsv()} element={<PageImportCsv />}/>
                        <Route path={routes.transactions()} element={<PageTransactions />}/>
                        <Route path={routes.createTransaction()} element={<PageCreateTransaction />} />
                        <Route path={routes.accounts()} element={<PageAccountOverview />} />
                        <Route path={routes.account(":id")} element={<PageAccount />} />
                        <Route path={routes.preferences()} element={<PagePreferences />} />
                    </Routes>
                </div>
            </div>
        </preferencesContext.Provider>
    </React.StrictMode>;

    function updatePreferences(newPreferences: Preferences | null) {
        if (newPreferences !== null) {
            setPreferences(newPreferences);
        } else {
            setPreferences("fetching");
            Api.Preferences.get()
                .then(result => {
                    setPreferences(result);
                })
                .catch(e => {
                    console.log(e);
                    setPreferences("fetching");
                });
        }
    }
}
