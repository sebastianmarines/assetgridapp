import Decimal from "decimal.js";
import { DateTime } from "luxon";
import * as React from "react";
import { forget, formatDateTimeWithUser, formatNumberWithUser } from "../../lib/Utils";
import { Account } from "../../models/account";
import { Transaction, TransactionLine } from "../../models/transaction";
import InputAccount from "../account/input/InputAccount";
import InputCategory from "../input/InputCategory";
import InputDateTime from "../input/InputDateTime";
import InputText from "../input/InputText";
import TransactionLink from "./TransactionLink";
import * as regular from "@fortawesome/free-regular-svg-icons";
import * as solid from "@fortawesome/free-solid-svg-icons";
import { useApi } from "../../lib/ApiClient";
import AccountLink from "../account/AccountLink";
import InputButton from "../input/InputButton";
import InputNumber from "../input/InputNumber";
import Tooltip from "../common/Tooltip";
import InputIconButton from "../input/InputIconButton";
import { userContext } from "../App";
import DeleteTransactionModal from "./input/DeleteTransactionModal";
import InputCheckbox from "../input/InputCheckbox";
import { Link } from "react-router-dom";
import { routes } from "../../lib/routes";
import { SearchGroupType, SearchOperator } from "../../models/search";

interface Props {
    transaction: Transaction
    updateItem: (id: number, item: Transaction | null) => void
    accountId?: number
    balance?: Decimal
    allowSelection?: boolean
    allowEditing?: boolean
    allowLinks?: boolean
    selected?: boolean
    toggleSelected?: (transaction: Transaction) => void
}

interface TransactionEditingModel {
    total: Decimal
    description: string
    dateTime: DateTime
    source: Account | null
    destination: Account | null
    category: string
    lines: TransactionLine[] | null
};

export default function TransactionTableLine (props: Props): React.ReactElement {
    const [disabled, setDisabled] = React.useState(false);
    const [state, setState] = React.useState<null | "editing" | "confirm-delete">(null);

    switch (state) {
        case "editing":
            return <TransactionEditor disabled={disabled} setDisabled={setDisabled} stopEditing={() => setState(null)} {...props} />;
        default:
            return <TableTransaction setState={setState} isConfirmingDeletion={state === "confirm-delete"} disabled={disabled} {...props} />;
    }
}

/*
 * Transaction that is not currently being edited
 */
type TableTransactionProps = Props & {
    disabled: boolean
    setState: (state: null | "editing" | "confirm-delete") => void
    isConfirmingDeletion: boolean
};
function TableTransaction (props: TableTransactionProps): React.ReactElement {
    const offsetAccount = props.accountId !== undefined ? props.transaction.destination?.id === props.accountId ? props.transaction.source : props.transaction.destination : null;
    const total = props.accountId === undefined || props.transaction.destination?.id === props.accountId ? props.transaction.total : props.transaction.total.neg();
    const totalClass = (total.greaterThan(0) && props.accountId !== undefined ? "positive" : (total.lessThan(0) && props.accountId !== undefined ? "negative" : ""));
    const [expandSplit, setExpandSplit] = React.useState(false);
    const { user } = React.useContext(userContext);

    return <div key={props.transaction.id} className="table-row">
        <div>
            {props.selected !== undefined && props.allowSelection === true && <InputCheckbox onChange={() => props.toggleSelected?.(props.transaction)} value={props.selected} />}
            <TransactionLink transaction={props.transaction} disabled={!(props.allowLinks ?? true)} />
            {props.transaction.lines.length > 0 && <Tooltip
                content={expandSplit ? "This is a split transaction. Click to collapse." : "This is a split transaction. Click to expand."}>
                <InputIconButton icon={solid.faEllipsisVertical} onClick={() => setExpandSplit(expand => !expand)} />
            </Tooltip>}
        </div>
        <div>{formatDateTimeWithUser(props.transaction.dateTime, user)}</div>
        <div>{props.transaction.description.length < 50
            ? props.transaction.description
            : <Tooltip content={props.transaction.description}>{props.transaction.description.substring(0, 50)}&hellip;</Tooltip>}</div>
        <div className={"number-total " + totalClass}>
            {formatNumberWithUser(total, user)}
        </div>
        {(props.balance != null) && <div className={"number-total"} style={{ fontWeight: "normal" }}>
            {formatNumberWithUser(props.balance, user)}
        </div>}
        <div>
            {props.accountId !== undefined
                ? offsetAccount !== null && <AccountLink account={offsetAccount} disabled={!(props.allowLinks ?? true)} />
                : props.transaction.source !== null && <AccountLink account={props.transaction.source} disabled={!(props.allowLinks ?? true)} />}
        </div>
        {props.accountId === undefined && <div>
            {props.transaction.destination !== null && <AccountLink account={props.transaction.destination} disabled={!(props.allowLinks ?? true)} />}
        </div>}
        <div>
            <Link to={routes.transactions()}
                state={{ searchMode: "advanced", query: { type: SearchGroupType.Query, query: { operator: SearchOperator.Equals, not: false, column: "Category", value: props.transaction.category } } }}>
                {props.transaction.category}
            </Link>
        </div>
        {props.allowEditing === true && <div>
            {!props.disabled && <>
                <InputIconButton icon={solid.faPen} onClick={() => props.setState("editing")} />
                <InputIconButton icon={regular.faTrashCan} onClick={() => props.setState("confirm-delete")} />
            </>}

            {/* Deletion modal */}
            {props.isConfirmingDeletion && <DeleteTransactionModal
                close={() => props.setState(null)}
                deleted={() => props.updateItem(props.transaction.id, null)}
                transaction={props.transaction} />}
        </div>}
        {expandSplit && <div className="transaction-lines split">
            {props.transaction.lines.map((line, i) => <div key={i} className={"transaction-line" + (i === props.transaction.lines.length - 1 ? " last" : "")}>
                <div style={{ gridColumn: "colstart/innerstart" }}></div>
                <div className="description">
                    {line.description}
                </div>
                <div className="total">
                    {formatNumberWithUser(line.amount, user)}
                </div>
                <div style={{ gridColumn: "innerend/colend" }}></div>
            </div>)}
        </div>}
    </div>;
}

/*
 * Inline transaction editor for transaction tables
 */
type TransactionEditorProps = Props & {
    disabled: boolean
    setDisabled: (disabled: boolean) => void
    stopEditing: () => void
};

function TransactionEditor (props: TransactionEditorProps): React.ReactElement {
    const defaultModel = {
        total: props.transaction.total,
        dateTime: props.transaction.dateTime,
        description: props.transaction.description,
        source: props.transaction.source,
        destination: props.transaction.destination,
        category: props.transaction.category,
        lines: props.transaction.lines.length > 0 ? props.transaction.lines : null
    };
    const [model, setModel] = React.useState<TransactionEditingModel>(defaultModel);
    const [errors, setErrors] = React.useState<{ [key: string]: string[] }>({});
    const { user } = React.useContext(userContext);
    const api = useApi();

    const total = props.accountId === undefined || props.transaction.destination?.id === props.accountId ? props.transaction.total : props.transaction.total.neg();
    const totalClass = (total.greaterThan(0) && props.accountId !== undefined ? "positive" : (total.lessThan(0) && props.accountId !== undefined ? "negative" : ""));
    // If the current account is the source, all amounts should be negative
    const amountMultiplier = props.accountId !== undefined && props.accountId === props.transaction.source?.id ? new Decimal(-1) : new Decimal(1);

    return <div key={props.transaction.id} className="table-row editing">
        <div>
            {props.selected !== undefined && props.allowSelection === true &&
                <InputCheckbox onChange={() => props.toggleSelected?.(props.transaction)} value={props.selected} />}
            <TransactionLink transaction={props.transaction} />
        </div>
        <div>
            <InputDateTime value={model.dateTime}
                fullwidth={true}
                onChange={e => setModel({ ...model, dateTime: e })}
                disabled={props.disabled}
                errors={errors.DateTime} /></div>
        <div>
            <InputText value={model.description}
                onChange={(e) => setModel({ ...model, description: e.target.value })}
                disabled={props.disabled}
                errors={errors.Description} /></div>
        {model.lines === null
            ? <div>
                <InputNumber allowNull={false}
                    value={model.total.times(amountMultiplier)}
                    onChange={newTotal => setModel({ ...model, total: newTotal.times(amountMultiplier) })}
                    errors={errors.Total} />
            </div>
            : < div className={"number-total " + totalClass}>
                {/* If the transaction is split, the total is the sum of the lines */}
                {formatNumberWithUser(model.total.times(amountMultiplier), user)}
            </div>
        }
        {(props.balance != null) && <div className={"number-total"} style={{ fontWeight: "normal" }}>{formatNumberWithUser(props.balance, user)}</div>}
        {(props.accountId === undefined || props.accountId !== props.transaction.source?.id) && <div>
            <InputAccount
                value={model.source}
                disabled={props.disabled}
                allowNull={true}
                onChange={account => setModel({ ...model, source: account })}
                allowCreateNewAccount={true}
                errors={errors.SourceAccountId} />
        </div>}
        {(props.accountId === undefined || props.accountId !== props.transaction.destination?.id) && <div>
            <InputAccount
                value={model.destination}
                disabled={props.disabled}
                allowNull={true}
                onChange={account => setModel({ ...model, destination: account })}
                allowCreateNewAccount={true}
                errors={errors.DestinationAccountId} />
        </div>}
        <div>
            <InputCategory
                value={model.category}
                disabled={props.disabled}
                onChange={category => setModel({ ...model, category })}
                errors={errors.Category} />
        </div>
        <div>
            {!props.disabled && api !== null && <>
                <InputIconButton icon={solid.faSave} onClick={forget(saveChanges)} />
                <InputIconButton icon={solid.faXmark} onClick={props.stopEditing} />
            </>}
        </div>
        {model.lines !== null
            ? < div className="transaction-lines split">
                {model.lines.map((line, i) => <TransactionLineEditor key={i}
                    line={line}
                    update={changes => updateLine(changes, i)}
                    delete={() => deleteLine(i)}
                    disabled={props.disabled}
                    inverse={amountMultiplier.toNumber() === -1}
                    last={i === model.lines!.length} />)}
                <div style={{ gridColumn: "span 3" }}></div>
                <div className="btn-add-line">
                    <InputButton className="is-small"
                        onClick={() => setModel({
                            ...model,
                            lines: [...model.lines!, { amount: new Decimal(0), description: "Transaction line" }]
                        })}>Add line</InputButton>
                </div>
                <div style={{ gridColumn: "span 4" }}></div>
            </div>
            : < div className="transaction-lines non-split">
                <InputButton className="is-small"
                    onClick={() => setModel({
                        ...model,
                        lines: [{ amount: props.transaction.total, description: "Transaction line" }]
                    })}>Split transaction</InputButton>
            </div>}
    </div>;

    async function saveChanges (): Promise<void> {
        if (model === null || api === null) return;

        props.setDisabled(true);
        setErrors({});

        const result = await api.Transaction.update(props.transaction.id, {
            dateTime: model.dateTime,
            description: model.description,
            sourceId: model.source?.id ?? -1,
            destinationId: model.destination?.id ?? -1,
            category: model.category,
            total: model.total,
            lines: model.lines ?? []
        });

        if (result.status === 200) {
            props.updateItem(props.transaction.id, result.data);
            props.stopEditing();
        } else if (result.status === 400) {
            setErrors(result.errors);
        }
        props.setDisabled(false);
    }

    function updateLine (newLine: Partial<TransactionLine>, index: number): void {
        if (model === null || model.lines === null) return;

        const lines = [
            ...model.lines.slice(0, index),
            { ...model.lines[index], ...newLine },
            ...model.lines.slice(index + 1)
        ];
        setModel({
            ...model,
            total: lines.reduce((sum, line) => sum.add(line.amount), new Decimal(0)),
            lines
        });
    }

    function deleteLine (index: number): void {
        if (model === null || model.lines === null) return;

        const newLines = [...model.lines.slice(0, index), ...model.lines.slice(index + 1)];
        const total = newLines.length > 0 ? newLines.reduce((sum, line) => sum.add(line.amount), new Decimal(0)) : model.lines[index].amount;
        setModel({
            ...model,
            total,
            lines: newLines.length > 0 ? newLines : null
        });
    }
}

/*
 * Inline editor for a transaction line
 */
interface LineEditorProps {
    line: TransactionLine
    update: (changes: Partial<TransactionLine>) => void
    delete: () => void
    disabled: boolean
    last: boolean
    inverse: boolean
}
function TransactionLineEditor (props: LineEditorProps): React.ReactElement {
    const multiplier = props.inverse ? new Decimal(-1) : new Decimal(1);

    return <div className={"transaction-line" + (props.last ? " last" : "")}>
        <div style={{ gridColumn: "colstart/innerstart" }}>
            <InputIconButton icon={solid.faGripLinesVertical} onClick={() => 0} />
        </div>
        <div className="description">
            <InputText disabled={props.disabled}
                isSmall={true}
                value={props.line.description}
                onChange={e => props.update({ description: e.target.value })} />
        </div>
        <div className="total">
            <InputNumber
                disabled={props.disabled}
                allowNull={false}
                isSmall={true}
                value={props.line.amount.times(multiplier)}
                onChange={value => props.update({ amount: value.times(multiplier) })} />
        </div>
        <div style={{ gridColumn: "innerend/colend" }}>
            <InputIconButton icon={regular.faTrashCan} onClick={props.delete} />
        </div>
    </div>;
}
