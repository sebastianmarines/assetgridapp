import axios from "axios";
import * as React from "react";
import { Account, CreateAccount as CreateAccountModel } from "../../models/account";
import CreateAccount from "../form/account/CreateAccount";
import InputCreateAccount from "../form/account/InputCreateAccount";
import InputButton from "../form/InputButton";
import { AccountReference, capitalize, castFieldValue, CsvCreateTransaction } from "./ImportModels";

interface Props {
    transactions: CsvCreateTransaction[];
    setTransactions: (transactions: CsvCreateTransaction[]) => void;
}

interface State {
    rowOffset: number;
    creatingAccount: CreateAccountModel | null;
    creating: boolean;
}

const pageSize: number = 20;

/*
 * React object class
 */
export default class MissingAccounts extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            rowOffset: 0,
            creatingAccount: null,
            creating: false,
        };
    }

    public render() {
        let uniqueAccounts = [
            ...this.props.transactions.map(transaction => transaction.from),
            ...this.props.transactions.map(transaction => transaction.to)
        ].filter(account => account !== null)
            .filter((account, index, array) => array.findIndex(accountB => accountB.identifier == account.identifier && accountB.value == account.value) == index)
            .filter(account => account.account === null);
        
        let rows = (uniqueAccounts ?? []).slice(this.state.rowOffset * pageSize, (this.state.rowOffset + 1) * pageSize);
        return <>
            { this.state.creatingAccount && <div className="modal is-active">
                <div className="modal-background"></div>
                <div className="modal-card">
                    <header className="modal-card-head">
                    <p className="modal-card-title">Create Account</p>
                    <button className="delete" aria-label="close" onClick={() => this.setState({creatingAccount: null})}></button>
                    </header>
                    <section className="modal-card-body">
                        <CreateAccount value={this.state.creatingAccount}
                            onChange={account => this.setState({ creatingAccount: account })}
                            onCreated={account => this.accountCreated(account)}/>
                    </section>
                    <footer className="modal-card-foot">
                    <button className="button is-success">Create Account</button>
                    <button className="button" onClick={() => this.setState({creatingAccount: null})}>Cancel</button>
                    </footer>
                </div>
            </div>}

            <h3 className="title is-5">Missing accounts</h3>
            <table className="table is-fullwidth is-hoverable">
                <thead>
                    <tr>
                        <th>Identifier</th>
                        <th>Value</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tfoot>
                    <tr>
                        <th>Identifier</th>
                        <th>Value</th>
                        <th>Actions</th>
                    </tr>
                </tfoot>
                <tbody>
                    {uniqueAccounts.length == 0 && <tr>
                        <td colSpan={4}>No accounts are missing</td>
                    </tr>}
                    {uniqueAccounts.length > 0 && rows.map(account => <tr key={account.identifier + "." + account.value}>
                            <td>{account.identifier}</td>
                            <td>{account.value}</td>
                        <td>{account.identifier !== "id" && <InputButton onClick={() => this.beginCreatingAccount(account)}>Create Account</InputButton>}</td>
                        </tr>)
                    }
                </tbody>
            </table>
        </>;
    }

    private beginCreatingAccount(accountReference: AccountReference): void
    {
        let account: CreateAccountModel = {
            name: "",
            description: "",
            accountNumber: "",
        };
        (account as any)[accountReference.identifier] = accountReference.value;
        this.setState({ creatingAccount: account });
    }

    private accountCreated(account: Account): void {
        debugger;
        this.props.setTransactions([...this.props.transactions.map(transaction => {
            let newTransaction = { ...transaction };
            let modified: boolean = false;
            if (account[transaction.from.identifier] === transaction.from.value) {
                newTransaction.from.account = account;
                modified = true;
            }
            if (account[transaction.to.identifier] === transaction.to.value) {
                newTransaction.to.account = account;
                modified = true;
            }

            if (modified) {
                return newTransaction;
            } else {
                return transaction;
            }
        })]);
        this.setState({ creatingAccount: null });
    }
}
