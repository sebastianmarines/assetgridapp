import * as React from "react";
import { Transaction } from "../../models/transaction";
import Table from "../common/Table";
import { SearchGroup, SearchGroupType, SearchOperator } from "../../models/search";
import { Api } from "../../lib/ApiClient";
import TransactionTableLine from "./TransactionTableLine";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowDownAZ, faArrowDownShortWide, faArrowDownWideShort, faArrowDownZA, faChevronDown } from "@fortawesome/free-solid-svg-icons";
import InputCheckbox from "../input/InputCheckbox";
import { useNavigate } from "react-router";
import { routes } from "../../lib/routes";
import { serializeQueryForHistory } from "./filter/FilterHelpers";
import MergeTransactionsModal from "./input/MergeTransactionsModal";
import DropdownContent from "../common/DropdownContent";

interface Props {
    draw?: number
    query?: SearchGroup
    allowEditing?: boolean
    allowLinks?: boolean
    small?: boolean
    pageSize?: number

    page?: [number, (page: number) => void]
    orderBy?: [{ column: string, descending: boolean }, (value: { column: string, descending: boolean }) => void]
    selectedTransactions?: [Set<number>, (transactions: Set<number>) => void]
    selectedTransaction?: [number | null, (value: number | null) => void]
}

export default React.memo(TransactionList, (a, b) =>
    a.draw === b.draw &&
    a.query === b.query &&
    a.allowEditing === b.allowEditing &&
    a.small === b.small &&
    a.pageSize === b.pageSize &&
    a.selectedTransactions?.[0] === b.selectedTransactions?.[0] &&
    a.selectedTransaction?.[0] === b.selectedTransaction?.[0] &&
    a.orderBy?.[0] === b.orderBy?.[0] &&
    a.page?.[0] === b.page?.[0]);
function TransactionList (props: Props): React.ReactElement {
    const [draw, setDraw] = React.useState(0);
    const [orderBy, setOrderBy] = (props.orderBy != null) ? props.orderBy : React.useState<{ column: string, descending: boolean }>({ column: "DateTime", descending: true });
    const [selectedTransactions, setSelectedTransactions] = (props.selectedTransactions != null) ? props.selectedTransactions : React.useState<Set<number>>(new Set());
    const [shownTransactions, setShownTransactions] = React.useState<Transaction[]>([]);
    const [isMergingTransactions, setIsMergingTransactions] = React.useState(false);
    const [page, setPage] = (props.page != null) ? props.page : React.useState(1);
    const navigate = useNavigate();

    const firstRender = React.useRef(true);

    return <>
        <Table<Transaction>
            page={page}
            goToPage={setPage}
            pageSize={props.pageSize ?? 20}
            draw={(props.draw ?? 0) + draw}
            type="async"
            renderType="custom"
            fetchItems={fetchItems}
            render={renderTable}
            afterDraw={transactions => setShownTransactions(transactions)}
        />
        {(props.selectedTransactions != null) && <MergeTransactionsModal active={isMergingTransactions}
            close={() => setIsMergingTransactions(false)}
            transactions={selectedTransactions}
            merged={() => { setIsMergingTransactions(false); setDraw(draw => draw + 1); }} />}
    </>;

    async function fetchItems (api: Api, from: number, to: number, draw: number): Promise<{ items: Transaction[], totalItems: number, offset: number, draw: number }> {
        const result = await api.Transaction.search({
            from,
            to,
            query: props.query,
            descending: orderBy.descending,
            orderByColumn: orderBy.column
        });
        const transactions: Transaction[] = result.data;

        // If it's not the first render, reset selected transactions
        if (!firstRender.current) {
            setSelectedTransactions(new Set());
        }
        firstRender.current = false;

        return {
            items: transactions,
            draw,
            offset: from,
            totalItems: result.totalItems
        };
    };

    function renderTable (items: Array<{ item: Transaction, index: number }>, renderPagination: () => React.ReactElement): React.ReactElement {
        const heading = <div className="table-heading">
            <div>
                {props.allowEditing === true && <TransactionSelectDropdownButton
                    clearSelection={() => setSelectedTransactions(new Set())}
                    selectAll={() => selectAllTransactions()}
                    selected={selectedTransactions.size > 0}
                    editSelection={() => beginEditMultiple("selection")}
                    editSelectionDisabled={selectedTransactions.size === 0}
                    editAll={() => beginEditMultiple("all")}
                    editAllText="Modify all transactions matching current search"
                    mergeSelection={() => setIsMergingTransactions(true)}
                />}
            </div>
            {renderColumnHeader("Timestamp", "DateTime", "numeric")}
            {renderColumnHeader("Description", "Description", "string")}
            {renderColumnHeader("Amount", "Total", "numeric", true)}
            {renderColumnHeader("Source", "SourceAccountId", "numeric")}
            {renderColumnHeader("Destination", "DestinationAccountId", "numeric")}
            {renderColumnHeader("Category", "Category", "string")}
            {props.allowEditing === true && <div>
                Actions
            </div>}
        </div>;

        const className = "transaction-table table is-fullwidth is-hoverable" +
            (props.allowEditing !== true ? " no-actions" : " multi-select") +
            (props.small === true ? " is-small" : "");

        return <>
            <div className={className}>
                {heading}
                <div className="table-body">
                    {items.map(({ item: transaction }) => {
                        return <TransactionTableLine
                            key={transaction.id}
                            transaction={transaction}
                            updateItem={redrawTable}
                            allowSelection={props.selectedTransaction !== undefined || props.selectedTransactions !== undefined}
                            allowEditing={props.allowEditing}
                            allowLinks={props.allowLinks}
                            selected={selectedTransactions.has(transaction.id) || props.selectedTransaction?.[0] === transaction.id}
                            toggleSelected={toggleSelected} />;
                    })}
                </div>
                {heading}
            </div>
            {renderPagination()}
        </>;

        function toggleSelected (transaction: Transaction): void {
            if (props.selectedTransactions != null) {
                if (selectedTransactions.has(transaction.id)) {
                    deselectTransaction(transaction);
                } else {
                    setSelectedTransactions(new Set([...selectedTransactions, transaction.id]));
                }
            }

            if (props.selectedTransaction != null) {
                if (props.selectedTransaction[0] === transaction.id) {
                    props.selectedTransaction[1](null);
                } else {
                    props.selectedTransaction[1](transaction.id);
                }
            }
        }
    }

    function beginEditMultiple (type: "selection" | "all"): void {
        if (props.query == null) {
            // Multi edit requires a query
            return;
        }

        const query: SearchGroup = type === "all"
            ? props.query
            : {
                type: SearchGroupType.And,
                children: [{
                    type: SearchGroupType.Query,
                    query: {
                        column: "Id",
                        not: false,
                        operator: SearchOperator.In,
                        value: [...selectedTransactions]
                    }
                }]
            };

        navigate(routes.transactionEditMultiple(), {
            state: {
                query: serializeQueryForHistory(query),
                showBack: true
            }
        });
    }

    function deselectTransaction (transaction: Transaction): void {
        const newSelectedTransactions = new Set(selectedTransactions);
        newSelectedTransactions.delete(transaction.id);
        setSelectedTransactions(newSelectedTransactions);
    }

    function selectAllTransactions (): void {
        const newSelectedTransactions: Set<number> = new Set(shownTransactions.map(t => t.id));
        setSelectedTransactions(newSelectedTransactions);
    }

    function renderColumnHeader (title: string, columnName: string, type: "numeric" | "string", rightAligned?: boolean): React.ReactElement {
        let sortIcon: React.ReactElement | undefined;
        if (orderBy.column === columnName) {
            switch (type) {
                case "numeric":
                    sortIcon = orderBy.descending
                        ? <span className="icon"><FontAwesomeIcon icon={faArrowDownWideShort} /></span>
                        : <span className="icon"><FontAwesomeIcon icon={faArrowDownShortWide} /></span>;
                    break;
                case "string":
                    sortIcon = orderBy.descending
                        ? <span className="icon"><FontAwesomeIcon icon={faArrowDownZA} /></span>
                        : <span className="icon"><FontAwesomeIcon icon={faArrowDownAZ} /></span>;
                    break;
            }
        }

        return <div className={"column-header sortable" + (rightAligned === true ? " has-text-right" : "")}
            onClick={() => switchOrderBy(columnName)}>
            {title}
            {sortIcon}
        </div>;
    }

    function switchOrderBy (column: string): void {
        if (orderBy.column === column) {
            setOrderBy({ column, descending: !orderBy.descending });
        } else {
            setOrderBy({ column, descending: false });
        }
        if (props.orderBy === undefined) {
            setDraw(draw => draw + 1);
        }
    }

    function redrawTable (): void {
        setDraw(draw => draw + 1);
    }
}

interface DropdownButtonProps {
    selectAll: () => void
    clearSelection: () => void
    selected: boolean
    editSelection: () => void
    editSelectionDisabled: boolean
    editAll: () => void
    editAllText: string
    mergeSelection: () => void
}
export function TransactionSelectDropdownButton (props: DropdownButtonProps): React.ReactElement {
    const [open, setOpen] = React.useState(false);
    const dropdownRef = React.useRef<HTMLDivElement>(null);

    return <div onBlur={onBlur}
        className={"buttons has-addons btn-multiselect dropdown is-trigger" + (open ? " is-active" : "")}>
        <button className="button is-small" onClick={() => props.selected ? props.clearSelection() : props.selectAll()}>
            <InputCheckbox
                onChange={() => 0}
                value={props.selected} />
        </button>
        <button className="button is-small" aria-haspopup="true" onClick={() => setOpen(true)}>
            <FontAwesomeIcon icon={faChevronDown} />
        </button>
        <DropdownContent active={open} fullWidth={false} preferedPosition="right">
            <div className={"dropdown-menu"} role="menu" style={{ maxWidth: "none" }} tabIndex={0} ref={dropdownRef}>
                <div className="dropdown-content">
                    <a className="dropdown-item"
                        onClick={() => !props.editSelectionDisabled && props.editSelection()}
                        style={props.editSelectionDisabled ? { color: "#999", cursor: "default" } : undefined}>
                        Modify selection
                    </a>
                    <a className="dropdown-item"
                        onClick={() => !props.editSelectionDisabled && props.mergeSelection()}
                        style={props.editSelectionDisabled ? { color: "#999", cursor: "default" } : undefined}>
                        Merge selected transactions
                    </a>
                    <a className="dropdown-item" onClick={props.editAll}>
                        {props.editAllText}
                    </a>
                </div>
            </div>
        </DropdownContent>
    </div>;

    function onBlur (e: React.FocusEvent): void {
        if (!e.currentTarget.contains(e.relatedTarget as Node) && !(dropdownRef.current?.contains(e.relatedTarget as Node) ?? false)) {
            setOpen(false);
        }
    }
}
