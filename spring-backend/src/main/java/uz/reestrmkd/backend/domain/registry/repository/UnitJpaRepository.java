package uz.reestrmkd.backend.domain.registry.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import uz.reestrmkd.backend.domain.registry.model.UnitEntity;

import java.time.Instant;
import java.math.BigDecimal;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface UnitJpaRepository extends JpaRepository<UnitEntity, UUID> {
    List<UnitEntity> findByFloorIdIn(Collection<UUID> floorIds);
    List<UnitEntity> findByFloorIdAndUnitTypeOrderByCreatedAtAscIdAsc(UUID floorId, String unitType);

    @Modifying
    @Query("update UnitEntity u set u.floorId = :targetFloorId, u.updatedAt = :updatedAt where u.floorId = :sourceFloorId")
    int remapFloorId(
        @Param("sourceFloorId") UUID sourceFloorId,
        @Param("targetFloorId") UUID targetFloorId,
        @Param("updatedAt") Instant updatedAt
    );

    @Modifying
    @Query("update UnitEntity u set u.cadastreNumber = :cadastre, u.updatedAt = :updatedAt where u.id = :id")
    int updateCadastreNumber(@Param("id") UUID id, @Param("cadastre") String cadastre, @Param("updatedAt") Instant updatedAt);

    @Modifying
    @Query("delete from UnitEntity u where u.floorId = :floorId and u.unitType = :unitType")
    int deleteByFloorIdAndUnitType(@Param("floorId") UUID floorId, @Param("unitType") String unitType);

    @Query("""
        select bb.buildingId as buildingId, u.unitCode as unitCode
        from UnitEntity u
        join FloorEntity f on f.id = u.floorId
        join BuildingBlockEntity bb on bb.id = f.blockId
        where bb.buildingId in :buildingIds
          and u.unitCode is not null
    """)
    List<BuildingUnitCodeRow> findUnitCodesByBuildingIds(@Param("buildingIds") Collection<UUID> buildingIds);

    @Query("""
        select u.id as id, lower(trim(u.number)) as normalizedNumber, f.blockId as blockId
        from UnitEntity u
        join FloorEntity f on f.id = u.floorId
        where f.blockId in :blockIds
          and lower(trim(u.number)) in :normalizedNumbers
    """)
    List<UnitNumberConflictRow> findUnitNumberConflicts(
        @Param("blockIds") Collection<UUID> blockIds,
        @Param("normalizedNumbers") Collection<String> normalizedNumbers
    );

    @Query("""
        select u.id as id,
               u.floorId as floorId,
               u.extensionId as extensionId,
               u.entranceId as entranceId,
               u.unitCode as unitCode,
               u.number as number,
               u.unitType as unitType,
               u.hasMezzanine as hasMezzanine,
               u.mezzanineType as mezzanineType,
               u.totalArea as totalArea,
               u.livingArea as livingArea,
               u.usefulArea as usefulArea,
               u.roomsCount as roomsCount,
               u.status as status,
               u.cadastreNumber as cadastreNumber,
               u.addressId as addressId,
               u.createdAt as createdAt,
               u.updatedAt as updatedAt,
               f.label as floorLabel,
               f.index as floorIndex,
               b.label as buildingLabel,
               b.houseNumber as buildingHouseNumber
        from UnitEntity u
        join FloorEntity f on f.id = u.floorId
        join BuildingBlockEntity bb on bb.id = f.blockId
        join BuildingEntity b on b.id = bb.buildingId
        where f.blockId = :blockId
    """)
    List<BlockUnitRow> findBlockUnitRowsByBlockId(@Param("blockId") UUID blockId);

    @Query("""
        select u.id as id,
               u.floorId as floorId,
               u.extensionId as extensionId,
               u.entranceId as entranceId,
               u.unitCode as unitCode,
               u.number as number,
               u.unitType as unitType,
               u.hasMezzanine as hasMezzanine,
               u.mezzanineType as mezzanineType,
               u.totalArea as totalArea,
               u.livingArea as livingArea,
               u.usefulArea as usefulArea,
               u.roomsCount as roomsCount,
               u.status as status,
               u.cadastreNumber as cadastreNumber,
               u.addressId as addressId,
               u.createdAt as createdAt,
               u.updatedAt as updatedAt,
               f.label as floorLabel,
               f.index as floorIndex,
               b.label as buildingLabel,
               b.houseNumber as buildingHouseNumber
        from UnitEntity u
        join FloorEntity f on f.id = u.floorId
        join BuildingBlockEntity bb on bb.id = f.blockId
        join BuildingEntity b on b.id = bb.buildingId
        where f.blockId = :blockId
           or u.floorId in :floorIds
    """)
    List<BlockUnitRow> findBlockUnitRowsByBlockIdOrFloorIdIn(
        @Param("blockId") UUID blockId,
        @Param("floorIds") Collection<UUID> floorIds
    );

    @Query("""
        select u.unitType as unitType,
               u.totalArea as totalArea,
               u.cadastreNumber as cadastreNumber
        from UnitEntity u
        join FloorEntity f on f.id = u.floorId
        join BuildingBlockEntity bb on bb.id = f.blockId
        join BuildingEntity b on b.id = bb.buildingId
        where b.projectId = :projectId
    """)
    List<TepUnitRow> findTepUnitRowsByProjectId(@Param("projectId") UUID projectId);

    interface BuildingUnitCodeRow {
        UUID getBuildingId();
        String getUnitCode();
    }

    interface UnitNumberConflictRow {
        UUID getId();
        UUID getBlockId();
        String getNormalizedNumber();
    }

    interface BlockUnitRow {
        UUID getId();
        UUID getFloorId();
        UUID getExtensionId();
        UUID getEntranceId();
        String getUnitCode();
        String getNumber();
        String getUnitType();
        Boolean getHasMezzanine();
        String getMezzanineType();
        BigDecimal getTotalArea();
        BigDecimal getLivingArea();
        BigDecimal getUsefulArea();
        Integer getRoomsCount();
        String getStatus();
        String getCadastreNumber();
        UUID getAddressId();
        Instant getCreatedAt();
        Instant getUpdatedAt();
        String getFloorLabel();
        Integer getFloorIndex();
        String getBuildingLabel();
        String getBuildingHouseNumber();
    }

    interface TepUnitRow {
        String getUnitType();
        BigDecimal getTotalArea();
        String getCadastreNumber();
    }
}
