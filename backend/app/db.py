"""DynamoDB access: one table, partitioned by space (the owner's pantry or a guest sandbox).

Rows in a sandbox space get a `ttl` attribute so DynamoDB deletes them when the sandbox expires.
"""

import os
import time
from decimal import Decimal
from functools import lru_cache
from typing import Any

import boto3
from boto3.dynamodb.conditions import Key


def table_name() -> str:
    return os.environ.get("TABLE_NAME", "pantry")


@lru_cache
def get_table():
    resource = boto3.resource(
        "dynamodb",
        endpoint_url=os.environ.get("DYNAMODB_ENDPOINT") or None,
        region_name=os.environ.get("AWS_REGION", "us-east-1"),
    )
    return resource.Table(table_name())


def create_table_if_missing() -> None:
    """Used for local dev and tests; in AWS the table is created by Terraform."""
    client = get_table().meta.client
    if table_name() in client.list_tables()["TableNames"]:
        return
    client.create_table(
        TableName=table_name(),
        AttributeDefinitions=[
            {"AttributeName": "pk", "AttributeType": "S"},
            {"AttributeName": "sk", "AttributeType": "S"},
        ],
        KeySchema=[
            {"AttributeName": "pk", "KeyType": "HASH"},
            {"AttributeName": "sk", "KeyType": "RANGE"},
        ],
        BillingMode="PAY_PER_REQUEST",
    )
    client.get_waiter("table_exists").wait(TableName=table_name())
    client.update_time_to_live(
        TableName=table_name(),
        TimeToLiveSpecification={"Enabled": True, "AttributeName": "ttl"},
    )


def _pk(space: str) -> str:
    return f"SPACE#{space}"


def _from_dynamo(row: dict[str, Any]) -> dict[str, Any]:
    """Drop key and TTL attributes and turn DynamoDB Decimals back into ints."""
    return {
        k: int(v) if isinstance(v, Decimal) else v
        for k, v in row.items()
        if k not in ("pk", "sk", "ttl")
    }


def _row(space: str, sk: str, data: dict[str, Any]) -> dict[str, Any]:
    # Imported here to avoid a cycle: sandbox ids are defined next to sandbox logic.
    from app.sandbox import expires_at

    row = {**data, "pk": _pk(space), "sk": sk}
    expiry = expires_at(space)
    if expiry is not None:
        row["ttl"] = expiry
    return row


def put(space: str, sk: str, data: dict[str, Any]) -> None:
    get_table().put_item(Item=_row(space, sk, data))


def get(space: str, sk: str) -> dict[str, Any] | None:
    row = get_table().get_item(Key={"pk": _pk(space), "sk": sk}).get("Item")
    return _from_dynamo(row) if row else None


def _query_raw(space: str, sk_prefix: str) -> list[dict[str, Any]]:
    table = get_table()
    condition = Key("pk").eq(_pk(space))
    if sk_prefix:
        condition = condition & Key("sk").begins_with(sk_prefix)
    response = table.query(KeyConditionExpression=condition)
    rows = response["Items"]
    while "LastEvaluatedKey" in response:
        response = table.query(
            KeyConditionExpression=condition,
            ExclusiveStartKey=response["LastEvaluatedKey"],
        )
        rows.extend(response["Items"])
    return rows


def query(space: str, sk_prefix: str) -> list[dict[str, Any]]:
    return [_from_dynamo(r) for r in _query_raw(space, sk_prefix)]


def delete(space: str, sk: str) -> None:
    get_table().delete_item(Key={"pk": _pk(space), "sk": sk})


def copy_space(source: str, target: str) -> int:
    """Copy every row of one space into another; returns the number of rows copied."""
    rows = _query_raw(source, "")
    with get_table().batch_writer() as batch:
        for row in rows:
            batch.put_item(Item=_row(target, row["sk"], _from_dynamo(row)))
    return len(rows)


def increment(key: str, ttl_seconds: int) -> int:
    """Atomically add 1 to a counter row (outside any space) and return the new value."""
    response = get_table().update_item(
        Key={"pk": f"COUNTER#{key}", "sk": "COUNTER"},
        UpdateExpression="ADD #n :one SET #ttl = if_not_exists(#ttl, :ttl)",
        ExpressionAttributeNames={"#n": "n", "#ttl": "ttl"},
        ExpressionAttributeValues={":one": 1, ":ttl": int(time.time()) + ttl_seconds},
        ReturnValues="UPDATED_NEW",
    )
    return int(response["Attributes"]["n"])
