import pandas as pd
import matplotlib.pyplot as plt


# ----- functions -----
def clean_cols(df):
   df.columns  = [c.lower().replace(' ', '_') for c in df.columns]
   return df 

# ----- data read-in -----

# violation codes
violation_codes = pd.read_excel('../raw/ParkingViolationCodes_January2020.xlsx')
violation_codes = clean_cols(violation_codes)
violation_codes = violation_codes.rename(columns = {
    'manhattan__96th_st._&_below\n(fine_amount_$)':'manhattan_96_below_fine', 
    'all_other_areas\n(fine_amount_$)' : 'all_other_fine'
})

# parking violations - in chunks
chunk_size = 500_000
all_chunks = pd.DataFrame()
for chunk in pd.read_csv('../raw/Parking_Violations_Issued_-_Fiscal_Year_2023_20241205.csv', chunksize=chunk_size):
    
    # clean up chunk columsn and filter out blanks
    chunk = clean_cols(chunk)
    chunk = chunk[chunk.plate_id != 'BLANKPLATE']

    # aggregate
    agg_chunk = chunk.groupby(
        ['plate_id', 'registration_state', 'plate_type', 'violation_code']).agg( 
        violations = ('summons_number', 'count')
    ).reset_index()
    
    # add to master df
    all_chunks = pd.concat([agg_chunk, all_chunks])

# group everything together, add in code information
all_chunks = all_chunks.groupby(
    ['plate_id', 'registration_state', 'plate_type', 'violation_code']).agg(
    violations = ('violations', 'sum')
).reset_index()
all_chunks = all_chunks.merge(violation_codes, how = 'left', on = 'violation_code')

# ----- save output -----

all_chunks.to_csv('../processed/parking_violations_agg_copy.csv', index = False)


