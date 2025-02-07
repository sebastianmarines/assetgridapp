﻿using assetgrid_backend.ViewModels;
using Microsoft.EntityFrameworkCore;
using System.ComponentModel.DataAnnotations;
using System.Linq;

namespace assetgrid_backend.Models
{
    public class Transaction : IValidatableObject
    {
        public int Id { get; set; }
        public int? SourceAccountId { get; set; }
        public virtual Account? SourceAccount { get; set; }
        public int? DestinationAccountId { get; set; }
        public virtual Account? DestinationAccount { get; set; }
        public DateTime DateTime { get; set; }

        [MaxLength(250)]
        public string Description { get; set; } = null!;
        public long Total { get; set; }

        [MaxLength(50)]
        public string Category { get; set; } = null!;

        public virtual List<TransactionLine> TransactionLines { get; set; } = null!;
        public virtual List<TransactionUniqueIdentifier> Identifiers { get; set; } = null!;

        IEnumerable<ValidationResult> IValidatableObject.Validate(ValidationContext validationContext)
        {
            if (SourceAccountId == null && DestinationAccountId == null)
            {
                yield return new ValidationResult(
                    $"Either source or destination id must be set.",
                    new[] { nameof(SourceAccountId), nameof(DestinationAccountId) });
            }
            else if (SourceAccountId == DestinationAccountId)
            {
                yield return new ValidationResult(
                    $"Source and destination must be different.",
                    new[] { nameof(SourceAccountId), nameof(DestinationAccountId) });
            }

            if (TransactionLines.Count > 0 && Total != TransactionLines.Select(line => line.Amount).Sum())
            {
                yield return new ValidationResult(
                    $"Sum of line amounts does not match transaction total",
                    new[] { nameof(Total), nameof(TransactionLines) });
            }
        }
    }

    public static class TransactionQueryableExtensions
    {
        public static IQueryable<ViewTransaction> SelectView(this IQueryable<Transaction> query, int userId)
        {
            return query.Select(transaction => new ViewTransaction
            {
                Id = transaction.Id,
                DateTime = transaction.DateTime,
                Description = transaction.Description,
                Source = transaction.SourceAccount == null ? null
                        : !transaction.SourceAccount.Users!.Any(user => user.UserId == userId) ? ViewAccount.GetNoReadAccess(transaction.SourceAccount.Id)
                            : new ViewAccount(
                                transaction.SourceAccount.Id,
                                transaction.SourceAccount.Name,
                                transaction.SourceAccount.Description,
                                // We don't include identifiers on transactions because it is unnecessary and because it fails during testing with MemoryDb
                                new List<string>(),
                                // transaction.SourceAccount.Identifiers!.Select(x => x.Identifier).ToList(),
                                transaction.SourceAccount.Users!.Single(user => user.UserId == userId).Favorite,
                                transaction.SourceAccount.Users!.Single(user => user.UserId == userId).IncludeInNetWorth,
                                ViewAccount.PermissionsFromDbPermissions(transaction.SourceAccount.Users!.Single(user => user.UserId == userId).Permissions),
                                0),
                Destination = transaction.DestinationAccount == null ? null
                        : !transaction.DestinationAccount.Users!.Any(user => user.UserId == userId) ? ViewAccount.GetNoReadAccess(transaction.DestinationAccount.Id)
                            : new ViewAccount(
                                transaction.DestinationAccount.Id,
                                transaction.DestinationAccount.Name,
                                transaction.DestinationAccount.Description,
                                // We don't include identifiers on transactions because it is unnecessary and because it fails during testing with MemoryDb
                                new List<string>(),
                                // transaction.DestinationAccount.Identifiers!.Select(x => x.Identifier).ToList(),
                                transaction.DestinationAccount.Users!.Single(user => user.UserId == userId).Favorite,
                                transaction.DestinationAccount.Users!.Single(user => user.UserId == userId).IncludeInNetWorth,
                                ViewAccount.PermissionsFromDbPermissions(transaction.DestinationAccount.Users!.Single(user => user.UserId == userId).Permissions),
                                0),
                Identifiers = transaction.Identifiers.Select(x => x.Identifier).ToList(),
                Category = transaction.Category,
                Lines = transaction.TransactionLines
                    .OrderBy(line => line.Order)
                    .Select(line => new ViewTransactionLine(line.Amount, line.Description))
                    .ToList(),
                Total = transaction.Total
            });
        }
    }
}
