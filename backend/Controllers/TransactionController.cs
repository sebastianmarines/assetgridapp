using assetgrid_backend.Data;
using assetgrid_backend.Models;
using assetgrid_backend.Models.ViewModels;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Linq.Expressions;

namespace assetgrid_backend.Controllers
{
    [ApiController]
    [EnableCors("AllowAll")]
    [Route("/api/v1[controller]")]
    public class TransactionController : ControllerBase
    {
        private readonly ILogger<TransactionController> _logger;
        private readonly HomebudgetContext _context;

        public TransactionController(ILogger<TransactionController> logger, HomebudgetContext context)
        {
            _logger = logger;
            _context = context;
        }

        [HttpGet()]
        [Route("/api/v1/[controller]/{id}")]
        public ViewTransaction? Get(int id)
        {
            var result = _context.Transactions
                .SelectView()
                .SingleOrDefault(transaction => transaction.Id == id);

            if (result == null) return null;

            return result;
        }

        [HttpPost()]
        public ViewTransaction Create(ViewCreateTransaction model)
        {
            if (string.IsNullOrWhiteSpace(model.Identifier))
            {
                model.Identifier = null;
            }

            if (ModelState.IsValid)
            {
                using (var transaction = _context.Database.BeginTransaction())
                {
                    // Set category
                    Category? category = null;
                    if (Category.Normalize(model.Category) != "")
                    {
                        category = _context.Categories.SingleOrDefault(category => category.NormalizedName == Category.Normalize(model.Category));
                        if (category == null)
                        {
                            category = new Category
                            {
                                Name = model.Category,
                                NormalizedName = Category.Normalize(model.Category),
                            };
                        }
                    }

                    var result = new Models.Transaction
                    {
                        DateTime = model.DateTime,
                        SourceAccountId = model.SourceId,
                        Description = model.Description,
                        DestinationAccountId = model.DestinationId,
                        Identifier = model.Identifier,
                        Total = model.Total ?? model.Lines.Select(line => line.Amount).Sum(),
                        Category = category,
                        TransactionLines = model.Lines.Select((line, i) => new Models.TransactionLine
                        {
                            Amount = line.Amount,
                            Description = line.Description,
                            Order = i + 1,
                        }).ToList(),
                    };

                    // Always store transactions in a format where the total is positive
                    if (result.Total < 0)
                    {
                        result.Total = -result.Total;
                        var sourceId = result.SourceAccountId;
                        result.SourceAccountId = result.DestinationAccountId;
                        result.DestinationAccountId = sourceId;
                        result.TransactionLines.ForEach(line => line.Amount = -line.Amount);
                    }

                    _context.Transactions.Add(result);
                    transaction.Commit();
                    _context.SaveChanges();
                    return new ViewTransaction {
                        Id = result.Id,
                        Identifier = result.Identifier,
                        DateTime = result.DateTime,
                        Description = result.Description,
                        Category = result.Category?.Name ?? "",
                        Source = result.SourceAccount != null
                            ? new ViewAccount
                            {
                                Id = result.SourceAccount.Id,
                                Name = result.SourceAccount.Name,
                                Description = result.SourceAccount.Description,
                            } : null,
                        Destination = result.DestinationAccount != null
                            ? new ViewAccount
                            {
                                Id = result.DestinationAccount.Id,
                                Name = result.DestinationAccount.Name,
                                Description = result.DestinationAccount.Description,
                            } : null,
                        Lines = result.TransactionLines
                            .OrderBy(line => line.Order)
                            .Select(line => new ViewTransactionLine
                            {
                                Amount = line.Amount,
                            }).ToList(),
                    };
                }
            }
            throw new Exception();
        }

        [HttpPut()]
        [Route("/api/v1/[controller]/{id}")]
        public ViewTransaction Update(int id, ViewUpdateTransaction model)
        {
            if (ModelState.IsValid)
            {
                using (var transaction = _context.Database.BeginTransaction())
                {
                    var dbObject = _context.Transactions
                        .Include(t => t.SourceAccount)
                        .Include(t => t.DestinationAccount)
                        .Include(t => t.TransactionLines)
                        .Single(t => t.Id == id);
                    var result = UpdateTransaction(dbObject, model);
                    transaction.Commit();
                    return result;
                }
            }
            throw new Exception();
        }

        [HttpPost()]
        [Route("/api/v1/[controller]/[Action]")]
        public void UpdateMultiple(ViewUpdateMultipleTransactions request)
        {
            if (ModelState.IsValid)
            {
                using (var transaction = _context.Database.BeginTransaction())
                {
                    var query = _context.Transactions
                        .Include(t => t.SourceAccount)
                        .Include(t => t.DestinationAccount)
                        .Include(t => t.TransactionLines)
                        .ApplySearch(request.query);

                    var transactions = query.ToList();
                    foreach (var dbObject in transactions)
                    {
                        UpdateTransaction(dbObject, request.model);
                    }
                    transaction.Commit();
                }
                return;
            }
            throw new Exception();
        }

        private ViewTransaction UpdateTransaction(Transaction dbObject, ViewUpdateTransaction model)
        {
            if (model.DateTime != null)
            {
                dbObject.DateTime = model.DateTime.Value;
            }
            if (model.Description != null)
            {
                dbObject.Description = model.Description;
            }
            if (model.HasUniqueIdentifier)
            {
                dbObject.Identifier = model.Identifier;
            }
            if (model.DestinationId != null)
            {
                dbObject.DestinationAccountId = model.DestinationId == -1 ? null : model.DestinationId;
            }
            if (model.SourceId != null)
            {
                dbObject.SourceAccountId = model.SourceId == -1 ? null : model.SourceId;
            }
            if (model.Category != null)
            {
                var previousCategoryId = dbObject.CategoryId;
                if (Category.Normalize(model.Category) != "")
                {
                    dbObject.Category = _context.Categories.SingleOrDefault(category => category.NormalizedName == Category.Normalize(model.Category));
                    if (dbObject.Category == null)
                    {
                        dbObject.Category = new Category
                        {
                            Name = model.Category,
                            NormalizedName = Category.Normalize(model.Category),
                        };
                    }
                }
                else
                {
                    dbObject.Category = null;
                    dbObject.CategoryId = null;
                }

                _context.SaveChanges();
                if (previousCategoryId.HasValue && ! _context.Transactions.Any(transaction => transaction.CategoryId == previousCategoryId)) {
                    // Remove categories that are not referenced by any transactions
                    _context.Categories.Remove(_context.Categories.Single(category => category.Id == previousCategoryId));
                }
            }
            if (model.Total != null && dbObject.TransactionLines.Count == 0)
            {
                dbObject.Total = model.Total.Value;
                if (dbObject.Total < 0)
                {
                    // All transactions must have positive totals
                    dbObject.Total = -dbObject.Total;
                    var source = dbObject.SourceAccountId;
                    dbObject.SourceAccountId = dbObject.DestinationAccountId;
                    dbObject.DestinationAccountId = source;
                }
            }
            if (model.Lines != null)
            {
                if (model.Total != null)
                {
                    dbObject.Total = model.Total.Value;
                }

                _context.RemoveRange(dbObject.TransactionLines);
                dbObject.TransactionLines = model.Lines.Select((line, index) =>
                    new TransactionLine
                    {
                        Amount = line.Amount,
                        Description = line.Description,
                        Order = index,
                        Transaction = dbObject,
                        TransactionId = dbObject.Id,
                    })
                    .ToList();

                if (dbObject.Total < 0)
                {
                    // All transactions must have positive totals
                    dbObject.Total = -dbObject.Total;
                    var source = dbObject.SourceAccountId;
                    dbObject.SourceAccountId = dbObject.DestinationAccountId;
                    dbObject.DestinationAccountId = source;
                    dbObject.TransactionLines.ForEach(line => line.Amount = -line.Amount);
                }
            }

            ModelState.Clear();
            if (TryValidateModel(dbObject))
            {
                _context.SaveChanges();

                return new ViewTransaction
                {
                    Id = dbObject.Id,
                    Identifier = dbObject.Identifier,
                    DateTime = dbObject.DateTime,
                    Description = dbObject.Description,
                    Category = dbObject.Category?.Name ?? "",
                    Total = dbObject.Total,
                    Source = dbObject.SourceAccount != null
                        ? new ViewAccount
                        {
                            Id = dbObject.SourceAccount.Id,
                            Name = dbObject.SourceAccount.Name,
                            Description = dbObject.SourceAccount.Description,
                        } : null,
                    Destination = dbObject.DestinationAccount != null
                        ? new ViewAccount
                        {
                            Id = dbObject.DestinationAccount.Id,
                            Name = dbObject.DestinationAccount.Name,
                            Description = dbObject.DestinationAccount.Description,
                        } : null,
                    Lines = dbObject.TransactionLines
                        .OrderBy(line => line.Order)
                        .Select(line => new ViewTransactionLine
                        {
                            Description = line.Description,
                            Amount = line.Amount,
                        }).ToList(),
                };
            }

            throw new Exception();
        }

        [HttpDelete()]
        [Route("/api/v1/[controller]/{id}")]
        public void Delete(int id)
        {
            using (var transaction = _context.Database.BeginTransaction())
            {
                var dbObject = _context.Transactions
                    .Single(t => t.Id == id);

                var categoryId = dbObject.CategoryId;

                _context.Transactions.Remove(dbObject);
                _context.SaveChanges();

                if (categoryId.HasValue && ! _context.Transactions.Any(transaction => transaction.CategoryId == categoryId))
                {
                    // Remove categories that are not referenced by any transactions
                    _context.Categories.Remove(_context.Categories.Single(category => category.Id == categoryId));
                }

                transaction.Commit();
                _context.SaveChanges();

                return;
            }
            throw new Exception();
        }

        [HttpDelete()]
        [Route("/api/v1/[controller]/[Action]")]
        public void DeleteMultiple(ViewSearchGroup query)
        {
            if (ModelState.IsValid)
            {
                using (var transaction = _context.Database.BeginTransaction())
                {
                    var transactions = _context.Transactions
                        .Include(t => t.TransactionLines)
                        .ApplySearch(query)
                        .ToList();

                    _context.RemoveRange(transactions.SelectMany(transaction => transaction.TransactionLines));
                    _context.RemoveRange(transactions);
                    _context.SaveChanges();

                    // Delete all categories that are unused by transactions
                    _context.Categories.RemoveRange(_context.Categories.Where(category => !_context.Transactions.Any(transaction => transaction.CategoryId == category.Id)));

                    _context.SaveChanges();
                    transaction.Commit();
                }
                return;
            }
            throw new Exception();
        }

        [HttpPost()]
        [Route("/api/v1/[controller]/[action]")]
        public ViewSearchResponse<ViewTransaction> Search(ViewSearch query)
        {
            var result = _context.Transactions
                .ApplySearch(query, true)
                .Skip(query.From)
                .Take(query.To - query.From)
                .SelectView()
                .ToList();

            return new ViewSearchResponse<ViewTransaction>
            {
                Data = result,
                TotalItems = _context.Transactions.ApplySearch(query, false).Count(),
            };
        }

        [HttpPost()]
        [Route("/api/v1/[controller]/[action]")]
        public List<string> FindDuplicates(List<string> identifiers)
        {
            return _context.Transactions
                .Where(transaction => transaction.Identifier != null && identifiers.Contains(transaction.Identifier))
                .Select(transaction => transaction.Identifier!)
                .ToList();
        }

        [HttpPost()]
        [Route("/api/v1/[controller]/[action]")]
        public ViewTransactionCreateManyResponse CreateMany(List<ViewCreateTransaction> transactions)
        {
            var failed = new List<ViewCreateTransaction>();
            var duplicate = new List<ViewCreateTransaction>();
            var success = new List<ViewCreateTransaction>();

            foreach (var transaction in transactions)
            {
                if (! string.IsNullOrWhiteSpace(transaction.Identifier) && _context.Transactions.Any(dbTransaction => dbTransaction.Identifier == transaction.Identifier))
                {
                    duplicate.Add(transaction);
                }
                else
                {
                    try
                    {
                        // Set category
                        Category? category = null;
                        if (Category.Normalize(transaction.Category) != "")
                        {
                            category = _context.Categories.SingleOrDefault(category => category.NormalizedName == Category.Normalize(transaction.Category));
                            if (category == null)
                            {
                                category = new Category
                                {
                                    Name = transaction.Category,
                                    NormalizedName = Category.Normalize(transaction.Category),
                                };
                            }
                        }

                        var result = new Models.Transaction
                        {
                            DateTime = transaction.DateTime,
                            SourceAccountId = transaction.SourceId,
                            Description = transaction.Description,
                            DestinationAccountId = transaction.DestinationId,
                            Identifier = transaction.Identifier,
                            Total = transaction.Total ?? transaction.Lines.Select(line => line.Amount).Sum(),
                            Category = category,
                            TransactionLines = transaction.Lines.Select((line, i) => new Models.TransactionLine
                            {
                                Amount = line.Amount,
                                Description = line.Description,
                                Order = i + 1,
                            }).ToList(),
                        };

                        // Always store transactions in a format where the total is positive
                        if (result.Total < 0)
                        {
                            result.Total = -result.Total;
                            var sourceId = result.SourceAccountId;
                            result.SourceAccountId = result.DestinationAccountId;
                            result.DestinationAccountId = sourceId;
                            result.TransactionLines.ForEach(line => line.Amount = -line.Amount);
                        }

                        _context.Transactions.Add(result);
                        _context.SaveChanges();
                        success.Add(transaction);
                    }
                    catch (Exception)
                    {
                        failed.Add(transaction);
                    }
                }
            }

            return new ViewTransactionCreateManyResponse
            {
                Succeeded = success,
                Duplicate = duplicate,
                Failed = failed,
            };
        }
    }
}