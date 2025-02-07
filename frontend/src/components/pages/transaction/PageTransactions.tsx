import * as React from "react";
import { Link } from "react-router-dom";
import { routes } from "../../../lib/routes";
import { debounce, emptyQuery } from "../../../lib/Utils";
import { SearchGroup, SearchGroupType, SearchOperator } from "../../../models/search";
import Card from "../../common/Card";
import Hero from "../../common/Hero";
import InputText from "../../input/InputText";
import TransactionFilterEditor from "../../transaction/filter/TransactionFilterEditor";
import TransactionList from "../../transaction/TransactionList";
import { deserializeQueryForHistory, serializeQueryForHistory } from "../../transaction/filter/FilterHelpers";

export default function PageTransactions (): React.ReactElement {
    const [draw, setDraw] = React.useState(0);
    const history = window.history.state.usr;
    const [query, setQuery] = React.useState<SearchGroup>(typeof history?.query === "object" ? deserializeQueryForHistory(history.query) : emptyQuery);
    const [searchString, setSearchString] = React.useState<string>(typeof (history?.searchString) === "string" ? history.searchString : "");
    const [searchMode, setSearchMode] = React.useState<"simple" | "advanced">(typeof (history?.searchMode) === "string" ? history.searchMode : "simple");
    const [orderBy, setOrderBy] = React.useState<{ column: string, descending: boolean }>(typeof history?.orderBy === "object" ? history.orderBy : { column: "DateTime", descending: true });
    const [page, setPage] = React.useState(typeof (history?.page) === "number" ? history.page : 1);
    const [selectedTransactions, setSelectedTransactions] = React.useState<Set<number>>(typeof history?.selectedTransactions === "object" ? history.selectedTransactions : new Set());

    // Match query and search string (don't run this on first render. Only on subsequent changes to search string)
    const isFirst = React.useRef(true);
    React.useEffect(() => {
        if (!isFirst.current) {
            updateSearchQueryFromText();
        }
        isFirst.current = false;
    }, [searchString]);

    // Keep history state updated
    const updateHistoryDebounced = React.useCallback(debounce(updateHistory, 300), []);
    React.useEffect(() => {
        updateHistoryDebounced({ query, searchMode, page, orderBy, searchString, selectedTransactions });
    }, [query, searchMode, page, orderBy, searchString, selectedTransactions]);

    // The table query is modified separately and debounced from the main query to prevent excessive redraws when modifying the query
    const [tableQuery, setTableQuery] = React.useState<SearchGroup>(query);
    const setTableQueryDebounced = React.useCallback(debounce((query: SearchGroup) => { setTableQuery(query); setDraw(draw => draw + 1); }, 300), []);
    const first = React.useRef(true);
    React.useEffect(() => {
        if (!first.current) {
            setTableQueryDebounced(query);
        }
        first.current = false;
    }, [query]);

    return <>
        <Hero title="Transactions" subtitle="Browse transactions" />
        <div className="p-3">
            <Card title="Search" isNarrow={false}>
                {searchMode === "simple"
                    ? <>
                        <InputText
                            label="Search for transactions"
                            value={searchString}
                            onChange={e => setSearchString(e.target.value)} />
                        <a onClick={() => setSearchMode("advanced")}>Advanced search</a>
                    </>
                    : <>
                        <TransactionFilterEditor query={query} setQuery={setQuery} />
                        <a onClick={() => setSearchMode("simple")}>Simple search</a>
                    </>}
            </Card>
            <Card title="Actions" isNarrow={false}>
                <Link to={routes.transactionCreate()} state={{ allowBack: true }}
                    className="button is-primary">
                    Create Transaction
                </Link>
            </Card>
            <Card title="Transactions" isNarrow={false}>
                <TransactionList
                    query={tableQuery}
                    draw={draw}
                    allowLinks={true}
                    allowEditing={true}
                    page={[page, setPage]}
                    orderBy={[orderBy, orderBy => { setOrderBy(orderBy); setDraw(draw => draw + 1); }]}
                    selectedTransactions={[selectedTransactions, setSelectedTransactions]}
                />
            </Card>
        </div>
    </>;

    function updateHistory (state: any): void {
        const { query, searchMode, page, orderBy, searchString, selectedTransactions } = state;
        window.history.replaceState({
            ...window.history.state,
            usr: {
                query: serializeQueryForHistory(query),
                searchMode,
                page,
                orderBy,
                searchString: (searchString?.trim() ?? "") === "" ? null : searchString,
                selectedTransactions
            }
        }, "");
    }

    function updateSearchQueryFromText (): void {
        if (searchString?.trim() === "") {
            setQuery(emptyQuery);
            return;
        }

        setQuery({
            type: SearchGroupType.Or,
            children: [{
                type: SearchGroupType.Query,
                query: {
                    column: "Id",
                    not: false,
                    operator: SearchOperator.Equals,
                    value: Number(searchString.replace(/\D/g, ""))
                }
            },
            {
                type: SearchGroupType.Query,
                query: {
                    column: "Description",
                    not: false,
                    operator: SearchOperator.Contains,
                    value: searchString
                }
            }]
        });
    }
}
