import pandas as pd
import numpy as np
from sodapy import Socrata
import googlemaps
from constants import google_maps_api_key

# ----- functions -----

def generate_shares(df, violation_code):
    sub_df = df[df.violation_code == violation_code].reset_index()
    sub_df = sub_df.sort_values('violations')

    sub_df['row_num'] = range(len(sub_df))
    sub_df['row_pct'] = sub_df.row_num / sub_df.shape[0]

    sub_df['cum_share'] = sub_df.violations.cumsum() / sub_df.violations.sum()

    return sub_df

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
        
def get_lat_long(row):
    try:
        address = (
            row['street_name'] + 
            str(row['intersecting_street']).replace('nan', '') + ' ' + 
            row['violation_county']  
        ).replace('@', '&')

        print(address)

        geocode_result = gmaps.geocode(address)

        return (
            str(geocode_result[0]['geometry']['location']['lat']) + 
            ',' + 
            str(geocode_result[0]['geometry']['location']['lng'])
        )
    except:
        print('none found')
        return 'null'
    

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



# ---- plate lookup ----- 

# resources:
# - https://github.com/xmunoz/sodapy?tab=readme-ov-file#getdataset_identifier-content_typejson-kwargs
# - https://dev.socrata.com/foundry/data.cityofnewyork.us/pvqr-7yc4

gmaps = googlemaps.Client(key=google_maps_api_key)
client = Socrata("data.cityofnewyork.us", None)

# grab sample plates and their violations
sample_plates = school_zone_agg[
    school_zone_agg.school_zone_violations_binned == '51+'].plate_id.sample(10)

results = pd.concat(
    [
        pd.DataFrame.from_records(
            client.get("pvqr-7yc4", plate_id=sample_plate, violation_code='36')
        )
        for sample_plate in sample_plates
    ],
    ignore_index=True
)

# get their lat long coordinates 
results['lat_long'] = results.apply(get_lat_long, axis = 1)
results['lat'] = results.lat_long.str.split(',', expand=True)[0]
results['long'] = results.lat_long.str.split(',', expand=True)[1]

# correct date
results['issue_dt'] = pd.to_datetime(results.issue_date)

# ---- output ----- 
results.to_csv('../processed/repeat_offenders_lat_long_sample.csv', index = False)
