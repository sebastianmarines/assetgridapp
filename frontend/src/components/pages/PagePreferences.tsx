import axios from "axios";
import Decimal from "decimal.js";
import { DateTime } from "luxon";
import * as React from "react";
import { Link } from "react-router-dom";
import { Api, useApi } from "../../lib/ApiClient";
import { routes } from "../../lib/routes";
import { formatDateTimeWithPreferences, formatDateTimeWithUser, formatDateWithPreferences, formatDateWithUser, formatNumber, formatNumberWithPreferences, formatNumberWithUser } from "../../lib/Utils";
import { Preferences } from "../../models/preferences";
import { userContext } from "../App";
import Card from "../common/Card";
import Hero from "../common/Hero";
import InputButton from "../input/InputButton";
import InputNumber from "../input/InputNumber";
import InputText from "../input/InputText";
import InputTextOrNull from "../input/InputTextOrNull";

export default function PagePreferences(): React.ReactElement {
    const { user, updatePreferences } = React.useContext(userContext);
    const [model, setModel] = React.useState<Preferences | "fetching">(user === "fetching" ? "fetching" : user.preferences);
    const [isUpdating, setIsUpdating] = React.useState(false);
    const api = useApi();

    React.useEffect(() => {
        // Whenever global preferences change, update this component to match
        if (user !== "fetching") {
            setModel(user.preferences);
        }
    }, [user === "fetching" ? "fetching" : user.preferences]);
    const exampleDateTime = React.useMemo(() => DateTime.fromJSDate(new Date()), [])

    return <>
        <Hero title="Preferences" subtitle="Modify preferences" />
        <div className="t-3">
            {renderContent()}
        </div>
    </>;

    function renderContent() {
        if (model === "fetching") {
            // This will only be shown until the global preferences are loaded.
            // Then the model will be set and will never be "fetching again"
            return <Card title="Number and date formatting" isNarrow={true}>
                Please wait&hellip;
            </Card>;
        }

        return <Card title="Number and date formatting" isNarrow={true}>
            <div className="columns mb-0">
                <div className="column">
                    <InputText value={model.decimalSeparator}
                        disabled={isUpdating}
                        label="Decimal Separator"
                        onChange={(event => setModel({
                            ...model,
                            decimalSeparator: event.target.value
                        }))} />
                </div>
                <div className="column">
                    <InputText value={model.thousandsSeparator}
                        disabled={isUpdating}
                        label="Thousands Separator"
                        onChange={(event => setModel({
                            ...model,
                            thousandsSeparator: event.target.value
                        }))} />
                </div>
                <div className="column">
                    <InputNumber value={new Decimal(model.decimalDigits)}
                        disabled={isUpdating}
                        label="Digits after decimal point"
                        allowNull={false}
                        onChange={(value => setModel({
                            ...model,
                            decimalDigits: Math.max(0, Math.min(value.round().toNumber(), 4))
                        }))} />
                </div>
            </div>
                
            <p className="pb-3 pt-1">Example: {
                formatNumberWithPreferences(new Decimal("123456789.123456789"), model)}
            </p>
                
            <div className="columns pt-3">
                <div className="column">
                    <InputTextOrNull value={model.dateFormat}
                        disabled={isUpdating}
                        noValueText="System default"
                        label="Date format"
                        onChange={(value => setModel({
                            ...model,
                            dateFormat: value
                        }))} />
                    <p>Example: {formatDateWithPreferences(exampleDateTime, model)}</p>
                </div>
                <div className="column">
                    <InputTextOrNull value={model.dateTimeFormat}
                        disabled={isUpdating}
                        label="Date and time format"
                        noValueText="System default"
                        onChange={(value => setModel({
                            ...model,
                            dateTimeFormat: value
                        }))} />
                    <p>Example: {formatDateTimeWithPreferences(exampleDateTime, model)}</p>
                </div>
            </div>
            <a href="https://moment.github.io/luxon/#/formatting?id=table-of-tokens" target="_blank">More information on date formats</a>

            <div className="buttons mt-5">
                <InputButton
                    disabled={isUpdating || api === null}
                    className="is-primary"
                    onClick={saveChanges}>
                    Save changes
                </InputButton>
            </div>
        </Card>;
    }
    
    function saveChanges() {
        if (isUpdating || model === "fetching" || api === null) {
            return;
        }

        setIsUpdating(true);
        api.User.updatePreferences(model)
            .then(result => {
                setIsUpdating(false);
                updatePreferences(result);
            })
            .catch(e => {
                console.log(e);
                setIsUpdating(false);
            });
    }
}