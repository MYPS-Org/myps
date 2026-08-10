using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DBHelper.Models.Table.Infra
{
    public class FutureBridge
    {
        [Key]
        public int Id { get; set; }
        [Required]
        public int NetworkStatusId { get; set; }
        [Required]
        public int InfraExistingOrFutureId { get; set; }
        [Required]
        [MaxLength(100)]
        public string RoadSectionId { get; set; } = string.Empty;
        [Required]
        [MaxLength(100)]
        public string BridgeId { get; set; } = string.Empty;
        [Required]
        [MaxLength(200)]
        public string Name { get; set; } = string.Empty;
        [Required]
        public Double From { get; set; }
        [Required]
        public Double Length { get; set; }
        public Double? CarriageWay { get; set; }
        [Required]
        public Double OverallWidth { get; set; }
        [Required]
        [MaxLength(200)]
        public string CreatedBy { get; set; } = string.Empty;
        [Required]
        public DateTime CreatedDate { get; set; }
        [MaxLength(200)]
        public string? UpdatedBy { get; set; }
        public DateTime? UpdatedDate { get; set; }
    }
}


/*
 Category: Helpers.ExceptionHandler
EventId: 0
SpanId: 869c2f696a3e7a2d
TraceId: 641b7ece0dc02796aac000e92d772da8
ParentId: 0000000000000000
RequestId: 8000017b-0003-fc00-b63f-84710c7967bb
RequestPath: /api/Program/updateProgramStage
ActionId: 01ebc37c-c022-469d-bd73-de8a9814790e
ActionName: WebAPI.Controllers.Programs.ProgramController.UpdateProgramStage (WebAPI)


/========================= MYPS ERROR EVENT STARTS HERE =========================/

ERROR
-----
ErrorId: 8a96e013-e1e5-4332-b7c3-24586cdff5dc
Timestamp: 2026-08-10T11:23:09.8859362+08:00

REQUEST
-------
Method: POST
Path: /api/Program/updateProgramStage
QueryString: 
TraceIdentifier: 8000017b-0003-fc00-b63f-84710c7967bb
RemoteIpAddress: 10.8.0.18
UserId: jimeneznr

PAYLOAD INFORMATION
-------------------
ClrType: WebAPI.Controllers.Programs.UpdateProgramStageDTO
PayloadType: Object
IsArray: False
ItemCount: 1
OriginalLength: 104
LoggedLength: 104
IsTruncated: False

API PAYLOAD
-----------
{
  "ProgramId": "jimeneznr_08102026_102720",
  "Stage": 2,
  "Name": "NEP 2026 - 2026 081026_100"
}

APPLICATION EXCEPTION
---------------------
Type: Microsoft.EntityFrameworkCore.DbUpdateException
Message: An error occurred while saving the entity changes. See the inner exception for details.

ROOT EXCEPTION
--------------
Type: System.ComponentModel.Win32Exception
Message: The wait operation timed out.

SQL SERVER ERROR
----------------
Description: SQL Server Error
Number: -2
State: 0
Class: 11
Procedure: 
LineNumber: 0
ClientConnectionId: c180c407-5aa5-421d-bbcf-cc19b96d54b3

SQL ERROR DETAILS
-----------------
Number=-2, State=0, Class=11, Line=0
Execution Timeout Expired.  The timeout period elapsed prior to completion of the operation or the server is not responding.

/========================= MYPS ERROR EVENT ENDS HERE =========================/


Exception: 
Microsoft.EntityFrameworkCore.DbUpdateException: An error occurred while saving the entity changes. See the inner exception for details.
 ---> Microsoft.Data.SqlClient.SqlException (0x80131904): Execution Timeout Expired.  The timeout period elapsed prior to completion of the operation or the server is not responding.
 ---> System.ComponentModel.Win32Exception (258): The wait operation timed out.
   at System.Threading.Tasks.ContinuationResultTaskFromResultTask`2.InnerInvoke()
   at System.Threading.ExecutionContext.RunInternal(ExecutionContext executionContext, ContextCallback callback, Object state)
--- End of stack trace from previous location ---
   at System.Threading.ExecutionContext.RunInternal(ExecutionContext executionContext, ContextCallback callback, Object state)
   at System.Threading.Tasks.Task.ExecuteWithThreadLocal(Task& currentTaskSlot, Thread threadPoolThread)
--- End of stack trace from previous location ---
   at Microsoft.EntityFrameworkCore.Storage.RelationalCommand.ExecuteReaderAsync(RelationalCommandParameterObject parameterObject, CancellationToken cancellationToken)
   at Microsoft.EntityFrameworkCore.Storage.RelationalCommand.ExecuteReaderAsync(RelationalCommandParameterObject parameterObject, CancellationToken cancellationToken)
   at Microsoft.EntityFrameworkCore.Update.ReaderModificationCommandBatch.ExecuteAsync(IRelationalConnection connection, CancellationToken cancellationToken)
ClientConnectionId:c180c407-5aa5-421d-bbcf-cc19b96d54b3
Error Number:-2,State:0,Class:11
   --- End of inner exception stack trace ---
   at Microsoft.EntityFrameworkCore.Update.ReaderModificationCommandBatch.ExecuteAsync(IRelationalConnection connection, CancellationToken cancellationToken)
   at Microsoft.EntityFrameworkCore.SqlServer.Update.Internal.SqlServerModificationCommandBatch.ExecuteAsync(IRelationalConnection connection, CancellationToken cancellationToken)
   at Microsoft.EntityFrameworkCore.Update.Internal.BatchExecutor.ExecuteAsync(IEnumerable`1 commandBatches, IRelationalConnection connection, CancellationToken cancellationToken)
   at Microsoft.EntityFrameworkCore.Update.Internal.BatchExecutor.ExecuteAsync(IEnumerable`1 commandBatches, IRelationalConnection connection, CancellationToken cancellationToken)
   at Microsoft.EntityFrameworkCore.Update.Internal.BatchExecutor.ExecuteAsync(IEnumerable`1 commandBatches, IRelationalConnection connection, CancellationToken cancellationToken)
   at Microsoft.EntityFrameworkCore.ChangeTracking.Internal.StateManager.SaveChangesAsync(IList`1 entriesToSave, CancellationToken cancellationToken)
   at Microsoft.EntityFrameworkCore.ChangeTracking.Internal.StateManager.SaveChangesAsync(StateManager stateManager, Boolean acceptAllChangesOnSuccess, CancellationToken cancellationToken)
   at Microsoft.EntityFrameworkCore.SqlServer.Storage.Internal.SqlServerExecutionStrategy.ExecuteAsync[TState,TResult](TState state, Func`4 operation, Func`4 verifySucceeded, CancellationToken cancellationToken)
   at Microsoft.EntityFrameworkCore.DbContext.SaveChangesAsync(Boolean acceptAllChangesOnSuccess, CancellationToken cancellationToken)
   at Microsoft.EntityFrameworkCore.DbContext.SaveChangesAsync(Boolean acceptAllChangesOnSuccess, CancellationToken cancellationToken)
   at WebAPI.Controllers.Programs.ProgramController.UpdateProgramStage(UpdateProgramStageDTO dto, CancellationToken cancellationToken) in C:\Users\khen\source\repos\mf1027\project_myps\WebAPI\Controllers\Programs\ProgramController.cs:line 854

 
 */