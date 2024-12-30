import pandas as pd
import matplotlib.pyplot as plt
import numpy as np
from sodapy import Socrata
import googlemaps

# ----- functions -----
def generate_shares(df, violation_code):
    sub_df = df[df.violation_code == violation_code].reset_index()
    sub_df = sub_df.sort_values('violations')

    sub_df['row_num'] = range(len(sub_df))
    sub_df['row_pct'] = sub_df.row_num / sub_df.shape[0]

    sub_df['cum_share'] = sub_df.violations.cumsum() / sub_df.violations.sum()

    return sub_df

def visualize_distribution(df, violation_code) :

    sub_df = generate_shares(df, violation_code)

    violation_desc = sub_df.iloc[0].violation_description

    sub_df.plot(x = 'row_pct', y = 'cum_share')
    plt.title(f'violation code: {violation_desc}')

def bin_violations(violations):
    match violations:
        case _ if violations <=1 :
            return '1'
        case _ if 1 < violations <= 5:
            return '1-5'
        case _ if 5 < violations <= 10:
            return '6-10'
        case _ if 10 < violations <= 15:
            return '11-15'
        case _ if  15 < violations <= 50:
            return '16-50'
        case _ if  violations > 50:
            return '51+'


# ----- data read-in -----

violations_agg = pd.read_csv('../processed/parking_violations_agg.csv')

# ---- categorize ----- 
red_light_agg = generate_shares(violations_agg, 7).rename(
    columns = {'violations':'red_light_violations'}
)
school_zone_agg = generate_shares(violations_agg, 36).rename(
    columns = {'violations':'school_zone_violations'}
)

school_zone_agg['school_zone_violations_binned'] = school_zone_agg.school_zone_violations.apply(bin_violations)

# ---- merge ----- 

merged = school_zone_agg.merge(
    red_light_agg[['plate_id', 'red_light_violations']], 
    how = 'left', 
    on = 'plate_id')
merged['red_light_violations'] = merged.red_light_violations.fillna(0)

# ----- save output -----

merged.to_csv('../processed/school_zone_violations.csv', index = False)

merged.iloc[::1000, :].to_csv('../processed/school_zone_violations_sparse.csv', index = False)

# ----- visualize -----

visualize_distribution(violations_agg, 7)
visualize_distribution(violations_agg, 36)

# ----- mean comparison -----

merged.red_light_violations.mean()

merged.groupby('school_zone_violations_binned').agg(
    red_light_violations = ('red_light_violations', 'mean'), 
    n = ('plate_id', 'count')).reset_index()


# ---- individual lookup ----- 

# resources:
# - https://github.com/xmunoz/sodapy?tab=readme-ov-file#getdataset_identifier-content_typejson-kwargs
# - https://dev.socrata.com/foundry/data.cityofnewyork.us/869v-vr48

from constants import google_maps_api_key

# Unauthenticated client only works with public data sets. 'None' in place of application token

sample_plate = school_zone_agg[
    school_zone_agg.school_zone_violations_binned == '51+'].plate_id.iloc[0]

client = Socrata("data.cityofnewyork.us", None)

results = pd.DataFrame.from_records(
    client.get("869v-vr48", 
               plate_id = sample_plate, 
               violation_code = '36'))

sample_address = (
    results.iloc[0].street_name + 
    results.iloc[0].intersecting_street + ' ' + 
    results.iloc[0].violation_county  
).replace('@', '&')

gmaps = googlemaps.Client(key=google_maps_api_key)
geocode_result = gmaps.geocode(sample_address)