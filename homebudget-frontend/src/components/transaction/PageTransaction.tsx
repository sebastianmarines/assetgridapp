import * as React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Api } from "../../lib/ApiClient";
import { formatNumberWithPrefs } from "../../lib/Utils";
import { Transaction, TransactionLine } from "../../models/transaction";
import AccountLink from "../account/AccountLink";
import { preferencesContext } from "../App";
import { Card } from "../common/Card";
import InputIconButton from "../form/InputIconButton";
import * as solid from "@fortawesome/free-solid-svg-icons"
import * as regular from "@fortawesome/free-regular-svg-icons"
import Modal from "../common/Modal";
import { routes } from "../../lib/routes";
import DeleteTransactionModal from "../form/transaction/DeleteTransactionModal";
import InputText from "../form/InputText";
import InputDate from "../form/InputDate";
import InputNumber from "../form/InputNumber";
import InputAccount from "../form/account/InputAccount";
import InputCategory from "../form/InputCategory";
import InputButton from "../form/InputButton";
import Decimal from "decimal.js";

export default function PageTransaction(): React.ReactElement {
    const id = Number(useParams().id);
    const [transaction, setTransaction] = React.useState<Transaction | "fetching">("fetching");
    const { preferences } = React.useContext(preferencesContext);
    const [isDeleting, setIsDeleting] = React.useState(false);
    const [editModel, setEditModel] = React.useState<Transaction | null>(null);
    const [isUpdating, setIsUpdating] = React.useState(false);
    const navigate = useNavigate();

    React.useEffect(fetchTransaction, [id]);

    return <>
        <section className="hero has-background-primary">
            <div className="hero-body">
                <p className="title has-text-white">Transaction #{id}</p>
                {transaction !== "fetching" && <p className="subtitle has-text-primary-light">
                    {transaction.description}
                </p>}
            </div>
        </section>
        <div className="p-3">
            <div className="columns">
                <div className="column p-0 is-narrow is-flex">
                    {transactionDetails(transaction,
                        isUpdating,
                        transaction => setEditModel(transaction),
                        editModel,
                        () => setIsDeleting(true),
                        update
                    )}
                </div>
                <div className="column p-0 is-narrow is-flex">
                    {transactionLines(transaction,
                        isUpdating,
                        transaction => setEditModel(transaction),
                        editModel,
                        () => setIsDeleting(true),
                        update)}
                </div>
            </div>
        </div>

        {/* Deletion modal */}
        {isDeleting && transaction !== "fetching" && <DeleteTransactionModal
            close={() => setIsDeleting(false)}
            deleted={() => navigate(routes.transactions())}
            transaction={transaction} />}
    </>;

    function fetchTransaction() {
        setTransaction("fetching");
        Api.Transaction.get(id)
            .then(transaction => setTransaction(transaction));
    }

    async function update() {
        setIsUpdating(true);
        const result = await Api.Transaction.update({
            ...editModel,
            sourceId: editModel.source?.id ?? -1,
            destinationId: editModel.destination?.id ?? -1
        });
        setTransaction(result);
        setIsUpdating(false);
        setEditModel(null);
    }
}

function transactionDetails(
    transaction: Transaction | "fetching",
    isUpdating: boolean,
    onChange: (transaction: Transaction) => void,
    editModel: Transaction | null,
    beginDelete: () => void,
    saveChanges: () => void,
): React.ReactElement {
    const { preferences } = React.useContext(preferencesContext);

    if (transaction === "fetching") {
        return <Card title="Transaction details">
            {transaction && <table className="table is-fullwidth">
                <tbody>
                    <tr>
                        <td>Id</td>
                        <td className="has-text-right">&hellip;</td>
                    </tr>
                    <tr>
                        <td>Description</td>
                        <td className="has-text-right">&hellip;</td>
                    </tr>
                    <tr>
                        <td>Timestamp</td>
                        <td className="has-text-right">&hellip;</td>
                    </tr>
                    <tr>
                        <td>Total</td>
                        <td className="has-text-right">&hellip;</td>
                    </tr>
                    <tr>
                        <td>Source</td>
                        <td className="has-text-right">&hellip;</td>
                    </tr>
                    <tr>
                        <td>Destination</td>
                        <td className="has-text-right">&hellip;</td>
                    </tr>
                    <tr>
                        <td>Category</td>
                        <td className="has-text-right">&hellip;</td>
                    </tr>
                </tbody>
            </table>}
        </Card>;
    }

    if (editModel === null) {
        return <Card title={<>
            <span style={{ flexGrow: 1 }}>Transaction details</span>
            <InputIconButton icon={solid.faPen} onClick={() => onChange(transaction)} />
            <InputIconButton icon={regular.faTrashCan} onClick={() => beginDelete()} />
        </>}>
            {transaction && <table className="table is-fullwidth">
                <tbody>
                    <tr>
                        <td>Id</td>
                        <td className="has-text-right">{transaction.id}</td>
                    </tr>
                    <tr>
                        <td>Description</td>
                        <td className="has-text-right">{transaction.description}</td>
                    </tr>
                    <tr>
                        <td>Timestamp</td>
                        <td className="has-text-right">{transaction.dateTime.toString()}</td>
                    </tr>
                    <tr>
                        <td>Total</td>
                        <td className="has-text-right">{formatNumberWithPrefs(transaction.total, preferences)}</td>
                    </tr>
                    <tr>
                        <td>Source</td>
                        <td className="has-text-right">
                            {transaction.source === null ? "None" : <AccountLink account={transaction.source} />}
                        </td>
                    </tr>
                    <tr>
                        <td>Destination</td>
                        <td className="has-text-right">
                            {transaction.destination === null ? "None" : <AccountLink account={transaction.destination} />}
                        </td>
                    </tr>
                    <tr>
                        <td>Category</td>
                        <td className="has-text-right">
                            {transaction.category}
                        </td>
                    </tr>
                </tbody>
            </table>}
        </Card>;
    } else {
        return <Card title="Transaction details">
            {transaction && <table className="table is-fullwidth">
                <tbody>
                    <tr>
                        <td>Id</td>
                        <td className="has-text-right">{transaction.id}</td>
                    </tr>
                    <tr>
                        <td>Description</td>
                        <td>
                            <InputText
                                value={editModel.description}
                                onChange={e => onChange({ ...editModel, description: e.target.value })}
                                disabled={isUpdating} />
                        </td>
                    </tr>
                    <tr>
                        <td>Timestamp</td>
                        <td>
                            <InputDate
                                value={editModel.dateTime}
                                onChange={value => onChange({ ...editModel, dateTime: value })}
                                disabled={isUpdating} />
                        </td>
                    </tr>
                    <tr>
                        <td>Total</td>
                        {editModel.lines.length === 0
                            ? <td><InputNumber
                                value={editModel.total}
                                onChange={value => onChange({ ...editModel, total: value })}
                                allowNull={false}
                                disabled={isUpdating} /></td>
                            : <td className="has-text-right">{formatNumberWithPrefs(editModel.total, preferences)}</td>}
                    </tr>
                    <tr>
                        <td>Source</td>
                        <td>
                            <InputAccount
                                value={editModel.source}
                                onChange={value => onChange({ ...editModel, source: value })}
                                allowNull={true}
                                allowCreateNewAccount={true}
                                disabled={isUpdating} />
                        </td>
                    </tr>
                    <tr>
                        <td>Destination</td>
                        <td>
                            <InputAccount
                                value={editModel.destination}
                                onChange={value => onChange({ ...editModel, destination: value })}
                                allowNull={true}
                                allowCreateNewAccount={true}
                                disabled={isUpdating} />
                        </td>
                    </tr>
                    <tr>
                        <td>Category</td>
                        <td>
                            <InputCategory
                                value={editModel.category}
                                onChange={value => onChange({ ...editModel, category: value })}
                                disabled={isUpdating} />
                        </td>
                    </tr>
                </tbody>
            </table>}
            <div className="buttons">
                <InputButton disabled={isUpdating} className="is-primary" onClick={saveChanges}>Save changes</InputButton>
                <InputButton onClick={() => onChange(null)}>Cancel</InputButton>
            </div>
        </Card>;
    }
}

function transactionLines(
    transaction: Transaction | "fetching",
    isUpdating: boolean,
    onChange: (transaction: Transaction) => void,
    editModel: Transaction | null,
    beginDelete: () => void,
    saveChanges: () => void,
): React.ReactElement {
    const { preferences } = React.useContext(preferencesContext);

    if (transaction === "fetching") {
        return <Card title="Transaction lines">
            Please wait&hellip;
        </Card>;
    }

    if (editModel === null) {
        /*
         * Not currently editing
         */
        if (transaction.lines.length === 0) {
            return <Card title={<>
                <span style={{ flexGrow: 1 }}>Transaction lines</span>
                    <InputIconButton icon={solid.faPen} onClick={() => onChange(transaction)} />
                </>}>
                This transaction does not have any lines.
            </Card>;
        } else {
            return <Card title={<>
                <span style={{ flexGrow: 1 }}>Transaction lines</span>
                    <InputIconButton icon={solid.faPen} onClick={() => onChange(transaction)} />
                </>}>
                <table className="table is-fullwidth">
                    <thead>
                        <tr>
                            <th>Description</th>
                            <th className="has-text-right">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        {transaction.lines.map((line, i) => <tr key={i}>
                            <td>{ line.description }</td>
                            <td className="has-text-right">{formatNumberWithPrefs(line.amount, preferences)}</td>
                        </tr>)}
                    </tbody>
                </table>
            </Card>;
        }
    } else {
        /*
         * Currently editing
         */
        if (editModel.lines.length === 0) {
            return <Card title="Transaction lines">
                <p>This transaction does not have any lines.</p>
                <p>Split the transaction to add lines.</p>
                <div className="buttons mt-3">
                    <InputButton disabled={isUpdating}
                        onClick={() => onChange({ ...editModel, lines: [{ description: "Transaction line", amount: editModel.total }] })}>
                        Split Transaction
                    </InputButton>
                </div>
            </Card>;
        } else {
            return <Card title="Transaction lines">
                <table className="table is-fullwidth">
                    <thead>
                        <tr>
                            <th>Description</th>
                            <th className="has-text-right">Amount</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {editModel.lines.map((line, i) => <tr key={i}>
                            <td>
                                <InputText value={line.description}
                                    onChange={e => updateLine({...line, description: e.target.value}, i)}
                                    disabled={isUpdating}
                                />
                            </td>
                            <td className="has-text-right">{
                                <InputNumber value={line.amount}
                                    onChange={value => updateLine({ ...line, amount: value }, i)}
                                    allowNull={false}
                                    disabled={isUpdating}
                                />
                            }</td>
                            <td style={{verticalAlign: "middle"}}>
                                <InputIconButton icon={regular.faTrashCan} onClick={() => deleteLine(i)} />
                            </td>
                        </tr>)}
                    </tbody>
                </table>
                <div className="buttons">
                    <InputButton disabled={isUpdating}
                        onClick={() => onChange({
                            ...editModel,
                            lines: [...editModel.lines, { description: "Transaction line", amount: new Decimal(0)}]
                        })}>
                        Add line
                    </InputButton>
                </div>
            </Card>;
        }
    }

    function updateLine(newLine: TransactionLine, index: number) {
        const lines = [
            ...editModel.lines.slice(0, index),
            newLine,
            ...editModel.lines.slice(index + 1)
        ];
        onChange({
            ...editModel,
            total: lines.reduce((sum, line) => sum.add(line.amount), new Decimal(0)),
            lines
        });
    }

    function deleteLine(index: number) {
        const newLines = [...editModel.lines.slice(0, index), ...editModel.lines.slice(index + 1)];
        const total = newLines.length > 0 ? newLines.reduce((sum, line) => sum.add(line.amount), new Decimal(0)) : editModel.lines[index].amount;
        onChange({
            ...editModel,
            total: total,
            lines: newLines
        });
    }
}