﻿using assetgrid_backend;
using assetgrid_backend.Controllers;
using assetgrid_backend.Data;
using assetgrid_backend.Helpers;
using assetgrid_backend.Models;
using assetgrid_backend.ViewModels;
using assetgrid_backend.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding.Validation;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Options;
using Moq;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Xunit;

namespace backend.unittests.Tests
{
    public class TaxonomyTests
    {
        public AssetgridDbContext Context { get; set; }
        public AccountController AccountController { get; set; }
        public TransactionController TransactionController { get; set; }
        public UserController UserController { get; set; }
        public UserService UserService { get; set; }
        public AccountService AccountService { get; set; }
        public UserAuthenticatedResponse User { get; set; }
        public TaxonomyController TaxonomyController { get; set; }

        public ViewAccount AccountA;
        public ViewAccount AccountB;

        public TaxonomyTests()
        {
            // Create DB context and connect
            var connection = new MySqlConnector.MySqlConnection("DataSource=:memory:");
            var options = new DbContextOptionsBuilder<AssetgridDbContext>()
                .UseInMemoryDatabase("Taxonomy" + Guid.NewGuid().ToString())
                .ConfigureWarnings(x => x.Ignore(InMemoryEventId.TransactionIgnoredWarning));
            Context = new AssetgridDbContext(options.Options);

            // Create user and log in
            UserService = new UserService(JwtSecret.Get(), Context);
            AccountService = new AccountService(Context);
            UserController = new UserController(Context, UserService, AccountService, Options.Create(new ApiBehaviorOptions()));
            UserController.CreateInitial(new AuthenticateModel { Email = "test", Password = "test" }).Wait();
            User = UserController.Authenticate(new AuthenticateModel { Email = "test", Password = "test" }).Result.OkValue<UserAuthenticatedResponse>();
            UserService.MockUser = UserService.GetById(User.Id).Result;

            // Setup account controller
            AccountController = new AccountController(Context, UserService, AccountService, Options.Create<ApiBehaviorOptions>(null!));
            TransactionController = new TransactionController(Context, UserService, Options.Create<ApiBehaviorOptions>(null!));
            TaxonomyController = new TaxonomyController(Context, UserService);

            var objectValidator = new Mock<IObjectModelValidator>();
            objectValidator.Setup(o => o.Validate(It.IsAny<ActionContext>(),
                                              It.IsAny<ValidationStateDictionary>(),
                                              It.IsAny<string>(),
                                              It.IsAny<Object>()));
            TransactionController.ObjectValidator = objectValidator.Object;

            var accountModel = new ViewCreateAccount
            {
                Name = "A",
                Description = "Description",
                Identifiers = new List<string>(),
                Favorite = false,
                IncludeInNetWorth = false,
            };
            AccountA = AccountController.Create(accountModel).Result.OkValue<ViewAccount>();
            accountModel.Name = "B";
            AccountB = AccountController.Create(accountModel).Result.OkValue<ViewAccount>();
        }


        [Fact]
        public async void CategoryAutocomplete()
        {
            var otherUser = await UserService.CreateUser("test2", "test");
            var model = new ViewCreateTransaction
            {
                Total = -500,
                DateTime = DateTime.Now,
                Description = "Test description",
                SourceId = AccountA.Id,
                DestinationId = AccountB.Id,
                Category = "Account A category",
                Identifiers = new List<string>(),
                Lines = new List<ViewTransactionLine>()
            };

            // Create account and transaction with User A
            await TransactionController.Create(model);
            Assert.Contains("Account A category", (await TaxonomyController.CategoryAutocomplete("cat")).OkValue<List<string>>());
            Assert.Contains("Account A category", (await TaxonomyController.CategoryAutocomplete("aCcOuNt")).OkValue<List<string>>());

            // No categories returned with user b
            UserService.MockUser = otherUser;
            Assert.Empty((await TaxonomyController.CategoryAutocomplete("cat")).OkValue<List<string>>());
            Assert.Empty((await TaxonomyController.CategoryAutocomplete("aCcOuNt")).OkValue<List<string>>());

            // Account A is shared with user B and it is suggested
            var UserAccount = new UserAccount {
                Account = Context.Accounts.Single(a => a.Id == AccountA.Id),
                AccountId = AccountA.Id,
                User = otherUser,
                UserId = otherUser.Id,
                Permissions = UserAccountPermissions.Read
            };
            Context.UserAccounts.Add(UserAccount);
            Context.SaveChanges();
            Assert.Contains("Account A category", (await TaxonomyController.CategoryAutocomplete("cat")).OkValue<List<string>>());
            Assert.Contains("Account A category", (await TaxonomyController.CategoryAutocomplete("aCcOuNt")).OkValue<List<string>>());

            // Account B is shared with user B and it is still suggested
            UserAccount.Account = Context.Accounts.Single(a => a.Id == AccountB.Id);
            UserAccount.AccountId = AccountB.Id;
            Context.SaveChanges();
            Assert.Contains("Account A category", (await TaxonomyController.CategoryAutocomplete("cat")).OkValue<List<string>>());
            Assert.Contains("Account A category", (await TaxonomyController.CategoryAutocomplete("aCcOuNt")).OkValue<List<string>>());
        }
    }
}
