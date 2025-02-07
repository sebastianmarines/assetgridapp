﻿using assetgrid_backend.ViewModels;

namespace assetgrid_backend.Models
{
    public class UserAccount
    {
        public int Id { get; set; }
        public int UserId { get; set; }
        public virtual User User { get; set; } = null!;
        public int AccountId { get; set; }
        public virtual Account Account { get; set; } = null!;
        public UserAccountPermissions Permissions { get; set; }
        public bool Favorite { get; set; }
        public bool IncludeInNetWorth { get; set; }
    }

    public static class AccountQueryableExtensions
    {
        public static IQueryable<ViewAccount> SelectView(this IQueryable<UserAccount> query)
        {
            return query.Select(account => new ViewAccount(
                account.AccountId,
                account.Account.Name,
                account.Account.Description,
                account.Account.Identifiers!.Select(x => x.Identifier).ToList(),
                account.Favorite,
                account.IncludeInNetWorth,
                (ViewAccount.AccountPermissions)(account.Permissions + 1),
                0
            ));
        }
    }

    public enum UserAccountPermissions
    {
        /// <summary>
        /// User can see transactions on this account, but can only create transactions between this account and accounts they own.
        /// The user cannot create new transfers to this account
        /// </summary>
        Read,

        /// <summary>
        /// User can modify all transactions on the account, but cannot change account properties or delete it
        /// </summary>
        ModifyTransactions,

        /// <summary>
        /// User has full access of the account and can change any property or delete it. They can also share the account with other users.
        /// </summary>
        All,
    }
}
