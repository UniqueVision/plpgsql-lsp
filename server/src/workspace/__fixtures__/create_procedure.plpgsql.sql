CREATE PROCEDURE proc1 (
    INOUT p1 text
)
    AS $$
BEGIN
    p1 := '!! ' || p1 || ' !!';
    RAISE NOTICE 'Procedure Parameter: %', p1;
END;
$$
LANGUAGE plpgsql;
