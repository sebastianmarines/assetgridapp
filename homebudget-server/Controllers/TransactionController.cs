using homebudget_server.Data;
using homebudget_server.Models;
using homebudget_server.Models.ViewModels;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace homebudget_server.Controllers
{
    [ApiController]
    [EnableCors("AllowAll")]
    [Route("[controller]")]
    public class TransactionController : ControllerBase
    {
        private readonly ILogger<TransactionController> _logger;
        private readonly HomebudgetContext _context;

        public TransactionController(ILogger<TransactionController> logger, HomebudgetContext context)
        {
            _logger = logger;
            _context = context;
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
                    var result = new Models.Transaction
                    {
                        DateTime = model.DateTime,
                        SourceAccountId = model.SourceId,
                        Description = model.Description,
                        DestinationAccountId = model.DestinationId,
                        Identifier = model.Identifier,
                        Total = model.Lines.Select(line => line.Amount).Sum(),
                        Category = model.Category,
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
                        Category = result.Category,
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
        [Route("/[controller]/{id}")]
        public ViewTransaction Update(int id, ViewUpdateTransaction model)
        {
            if (id != model.Id)
            {
                throw new Exception();
            }

            if (ModelState.IsValid)
            {
                using (var transaction = _context.Database.BeginTransaction())
                {
                    var dbObject = _context.Transactions
                        .Include(t => t.SourceAccount)
                        .Include(t => t.DestinationAccount)
                        .Include(t => t.TransactionLines)
                        .Single(t => t.Id == model.Id);
                    
                    if (model.DateTime != null)
                    {
                        dbObject.DateTime = model.DateTime.Value;
                    }
                    if (model.Description != null)
                    {
                        dbObject.Description = model.Description;
                    }
                    if (model.DestinationId != null)
                    {
                        dbObject.DestinationAccountId = model.DestinationId == -1 ? null : model.DestinationId;
                    }
                    if (model.SourceId != null)
                    {
                        dbObject.SourceAccountId = model.SourceId == -1 ? null : model.SourceId;
                    }

                    transaction.Commit();
                    _context.SaveChanges();

                    return new ViewTransaction
                    {
                        Id = dbObject.Id,
                        Identifier = dbObject.Identifier,
                        DateTime = dbObject.DateTime,
                        Description = dbObject.Description,
                        Category = dbObject.Category,
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
                                Amount = line.Amount,
                            }).ToList(),
                    };
                }
            }
            throw new Exception();
        }

        [HttpDelete()]
        [Route("/[controller]/{id}")]
        public void Delete(int id)
        {
            using (var transaction = _context.Database.BeginTransaction())
            {
                var dbObject = _context.Transactions
                    .Single(t => t.Id == id);

                _context.Transactions.Remove(dbObject);

                transaction.Commit();
                _context.SaveChanges();

                return;
            }
            throw new Exception();
        }

        [HttpPost()]
        [Route("/[controller]/[action]")]
        public ViewSearchResponse<ViewTransaction> Search(ViewSearch query)
        {
            var result = _context.Transactions
                .ApplySearch(query.Query)
                .Skip(query.From)
                .Take(query.To - query.From)
                .SelectView()
                .ToList();

            return new ViewSearchResponse<ViewTransaction>
            {
                Data = result,
                TotalItems = _context.Transactions.ApplySearch(query.Query).Count(),
            };
        }

        [HttpPost()]
        [Route("/[controller]/[action]")]
        public List<string> FindDuplicates(List<string> identifiers)
        {
            return _context.Transactions
                .Where(transaction => transaction.Identifier != null && identifiers.Contains(transaction.Identifier))
                .Select(transaction => transaction.Identifier!)
                .ToList();
        }

        [HttpPost()]
        [Route("/[controller]/[action]")]
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
                        var result = new Models.Transaction
                        {
                            DateTime = transaction.DateTime,
                            SourceAccountId = transaction.SourceId,
                            Description = transaction.Description,
                            DestinationAccountId = transaction.DestinationId,
                            Identifier = transaction.Identifier,
                            Total = transaction.Lines.Select(line => line.Amount).Sum(),
                            Category = transaction.Category,
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