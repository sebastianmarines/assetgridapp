import { DateTime } from "luxon";
import * as React from "react";
import { Period } from "../../models/period";
import NetWorthChart from "../account/NetWorthChart";
import Hero from "../common/Hero";

export default function PageDashboard (): React.ReactElement {
    const [period, setPeriod] = React.useState<Period>({
        type: "month",
        start: DateTime.now().startOf("month")
    });

    return <>
        <Hero title="Dashboard" subtitle="Overview of your finances" period={[period, setPeriod]} />
        <div className="p-3">
            <NetWorthChart period={period} showTable={true} />
        </div>
    </>;
}
