import Decimal from "decimal.js";
import { DateTime } from "luxon";
import { Account } from "./account";
import { SearchRequest, SearchResponse } from "./search";

export type Transaction = {
    id: number;
    source: Account | null;
    destination: Account | null;
    dateTime: DateTime;
    identifier: string | null;
    lines: TransactionLine[];
    category: string;
    description: string;

    total: Decimal;
}

export type CreateTransaction = {
    sourceId: number | null;
    destinationId: number | null;
    dateTime: DateTime;
    description: string;
    identifier: string | null;
    category: string;
    total: Decimal;
    lines: TransactionLine[];
}

export type UpdateTransaction = {
    identifier?: string | null;
    sourceId?: number | null;
    destinationId?: number | null;
    dateTime?: DateTime;
    description?: string;
    category?: string;
    total?: Decimal;
    lines?: TransactionLine[];
}

export type TransactionLine = {
    amount: Decimal;
    description: string;
}

export type TransactionListResponse = {
    total: Decimal;
} & SearchResponse<Transaction>