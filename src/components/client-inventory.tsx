import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function ClientInventory() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Inventory</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-muted-foreground">
        <p>Inventory module coming soon. Stock lots, restock, and SKU rules are pending the final specification.</p>
        <p>
          Sales can already store an optional SKU on the Sales tab. That reference is only a note on the sale and does not change stock.
        </p>
      </CardContent>
    </Card>
  );
}
