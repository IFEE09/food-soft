-- KDS Migration: add station_id to menu_items and order_items, add item_status to order_items
-- Safe to run multiple times (uses IF NOT EXISTS pattern via DO blocks)

DO $$
BEGIN
    -- 1. menu_items.station_id
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='menu_items' AND column_name='station_id'
    ) THEN
        ALTER TABLE menu_items ADD COLUMN station_id INTEGER REFERENCES stations(id) ON DELETE SET NULL;
        CREATE INDEX IF NOT EXISTS ix_menu_items_station_id ON menu_items(station_id);
        RAISE NOTICE 'Added menu_items.station_id';
    ELSE
        RAISE NOTICE 'menu_items.station_id already exists, skipping';
    END IF;

    -- 2. order_items.station_id
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='order_items' AND column_name='station_id'
    ) THEN
        ALTER TABLE order_items ADD COLUMN station_id INTEGER REFERENCES stations(id) ON DELETE SET NULL;
        CREATE INDEX IF NOT EXISTS ix_order_items_station_id ON order_items(station_id);
        RAISE NOTICE 'Added order_items.station_id';
    ELSE
        RAISE NOTICE 'order_items.station_id already exists, skipping';
    END IF;

    -- 3. order_items.item_status
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='order_items' AND column_name='item_status'
    ) THEN
        ALTER TABLE order_items ADD COLUMN item_status VARCHAR NOT NULL DEFAULT 'pending';
        RAISE NOTICE 'Added order_items.item_status';
    ELSE
        RAISE NOTICE 'order_items.item_status already exists, skipping';
    END IF;
END $$;
