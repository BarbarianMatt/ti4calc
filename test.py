import math
def lis(miss,num):
    l=[]
    for i in range(num+1):
        print(i)
        l.insert(i,(dis(num,i,1-miss)))
    return l

def dis(trials,successes,success):
    x=math.comb(trials,successes)*math.pow(success,successes)*math.pow(1-success,trials-successes)
    return x
oneRollMiss=0.7
print(lis(oneRollMiss,2))